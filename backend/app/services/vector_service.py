import math
import os
from typing import Any, Dict, List, Optional

import chromadb
import httpx
from chromadb.utils import embedding_functions

from config import Config


class TimedHuggingFaceEmbeddingFunction:
    """Small HTTP adapter with an explicit timeout and no response-body logging."""
    def __init__(self, api_key: str, model_name: str, timeout: float):
        self.api_key = api_key
        self.model_name = model_name
        self.timeout = max(1.0, min(float(timeout), 120.0))
        self.url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_name}"

    def __call__(self, documents: List[str]):
        response = httpx.post(
            self.url,
            json={"inputs": documents, "options": {"wait_for_model": True}},
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, list) or len(data) != len(documents):
            raise ValueError("embedding response shape invalid")
        vectors = []
        for embedding in data:
            if not isinstance(embedding, list) or not embedding or any(not isinstance(value, (int, float)) for value in embedding):
                raise ValueError("embedding response values invalid")
            vectors.append([float(value) for value in embedding])
        return vectors


class VectorService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            instance = super(VectorService, cls).__new__(cls)
            try:
                instance._init_chroma()
            except Exception:
                # Never cache a partially initialized service. A later request may
                # retry initialization after configuration or storage is repaired.
                cls._instance = None
                raise
            cls._instance = instance
        return cls._instance

    def _init_chroma(self):
        persist_dir = Config.CHROMA_PERSIST_DIR
        os.makedirs(persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.embedding_provider = "unavailable"
        self.embedding_fn = None

        hf_key = (Config.HUGGINGFACE_API_KEY or "").strip()
        valid_key = bool(hf_key and not hf_key.lower().startswith(("your_", "replace_")) and len(hf_key) > 10)
        if Config.USE_ONLINE_EMBEDDINGS and valid_key:
            try:
                self.embedding_fn = TimedHuggingFaceEmbeddingFunction(
                    hf_key, Config.SENTENCE_TRANSFORMER_MODEL, Config.EMBEDDING_TIMEOUT_SECONDS
                )
                self.embedding_provider = "huggingface"
            except Exception:
                print("[VectorService] Online embedding configuration failed.")

        if self.embedding_fn is None:
            try:
                self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()
                self.embedding_provider = "local_chroma"
            except Exception:
                print("[VectorService] Local embedding configuration failed.")

        # Versioned explicit-embedding collections avoid serializing provider
        # client objects or secrets into Chroma's collection configuration.
        # Existing legacy collections remain untouched for a safe migration.
        self.resume_collection = self.client.get_or_create_collection(
            name="hiremind_resumes_v2", embedding_function=None, metadata={"hnsw:space": "cosine"}
        )
        self.job_collection = self.client.get_or_create_collection(
            name="hiremind_jobs_v2", embedding_function=None, metadata={"hnsw:space": "cosine"}
        )

    @staticmethod
    def _safe_metadata(identifier_key: str, identifier: int, metadata: Optional[Dict[str, Any]]) -> dict:
        result = {identifier_key: int(identifier)}
        # Exclude names, email addresses, phone numbers, and free-form text.
        for key in ("experience",):
            value = (metadata or {}).get(key)
            if isinstance(value, (int, float)) and math.isfinite(value):
                result[key] = float(value)
        return result

    def index_resume(self, candidate_id: int, text: str, metadata: Optional[Dict[str, Any]] = None):
        try:
            if self.embedding_fn is None:
                return False
            embeddings = self.embedding_fn([text[:8000]])
            self.resume_collection.upsert(
                ids=[f"candidate_{candidate_id}"], documents=[text[:8000]], embeddings=embeddings,
                metadatas=[self._safe_metadata("candidate_id", candidate_id, metadata)],
            )
            return True
        except Exception:
            print("[VectorService] Resume index update failed.")
            return False

    def index_job(self, job_id: int, text: str, metadata: Optional[Dict[str, Any]] = None):
        try:
            if self.embedding_fn is None:
                return False
            embeddings = self.embedding_fn([text[:8000]])
            self.job_collection.upsert(
                ids=[f"job_{job_id}"], documents=[text[:8000]], embeddings=embeddings,
                metadatas=[self._safe_metadata("job_id", job_id, metadata)],
            )
            return True
        except Exception:
            print("[VectorService] Job index update failed.")
            return False

    def delete_resume(self, candidate_id: int):
        self.resume_collection.delete(ids=[f"candidate_{int(candidate_id)}"])

    def delete_job(self, job_id: int):
        self.job_collection.delete(ids=[f"job_{int(job_id)}"])

    @staticmethod
    def _text_overlap(resume_text: str, job_text: str) -> float:
        resume_words = set(resume_text.lower().split())
        job_words = set(job_text.lower().split())
        if not job_words:
            return 0.0
        overlap = len(resume_words.intersection(job_words)) / len(job_words)
        return round(min(100.0, overlap * 200.0), 1)

    def compute_similarity(self, resume_text: str, job_text: str) -> dict:
        if self.embedding_fn is None:
            return {"score": self._text_overlap(resume_text, job_text), "method": "lexical_overlap_fallback", "provider_status": "unavailable", "fallback_reason": "embedding_not_configured"}
        try:
            embeddings = self.embedding_fn([resume_text[:4000], job_text[:4000]])
            if len(embeddings) != 2 or len(embeddings[0]) == 0 or len(embeddings[0]) != len(embeddings[1]):
                raise ValueError("embedding vectors invalid")
            v1, v2 = embeddings[0], embeddings[1]
            if any(not math.isfinite(float(value)) for value in (*v1, *v2)):
                raise ValueError("embedding vectors invalid")
            dot_product = sum(a * b for a, b in zip(v1, v2))
            norm_a = math.sqrt(sum(a * a for a in v1))
            norm_b = math.sqrt(sum(b * b for b in v2))
            if norm_a == 0 or norm_b == 0:
                raise ValueError("zero embedding vector")
            cosine = max(-1.0, min(1.0, dot_product / (norm_a * norm_b)))
            score = round((cosine + 1.0) * 50.0, 1)
            return {"score": score, "method": f"{self.embedding_provider}_cosine", "provider_status": "available", "fallback_reason": None}
        except Exception as exc:
            status_code = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
            reason = "embedding_rate_limited" if status_code == 429 else "embedding_request_failed"
            return {"score": self._text_overlap(resume_text, job_text), "method": "lexical_overlap_fallback", "provider_status": "rate_limited" if status_code == 429 else "unavailable", "fallback_reason": reason}

    def compute_semantic_similarity(self, resume_text: str, job_text: str) -> float:
        """Backward-compatible scalar result; use compute_similarity for provenance."""
        return self.compute_similarity(resume_text, job_text)["score"]

    def find_top_candidates_for_job(self, job_text: str, n_results: int = 10) -> List[Dict[str, Any]]:
        if self.embedding_fn is None:
            return []
        try:
            count = self.resume_collection.count()
            if count == 0:
                return []
            query_embeddings = self.embedding_fn([job_text[:4000]])
            results = self.resume_collection.query(query_embeddings=query_embeddings, n_results=min(n_results, count))
            from app.models.candidate import Candidate
            current_ids = {candidate.id for candidate in Candidate.query.with_entities(Candidate.id).all()}
            matches = []
            for doc_id, dist, meta in zip(results.get("ids", [[]])[0], results.get("distances", [[]])[0], results.get("metadatas", [[]])[0]):
                try:
                    candidate_id = int(doc_id.removeprefix("candidate_"))
                except (TypeError, ValueError):
                    continue
                if candidate_id not in current_ids:
                    continue
                score = max(0.0, min(100.0, (1.0 - float(dist)) * 100.0))
                matches.append({"candidate_id": candidate_id, "semantic_score": round(score, 1), "metadata": meta or {}})
            return matches
        except Exception:
            return []
