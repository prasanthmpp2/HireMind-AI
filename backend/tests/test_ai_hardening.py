import unittest
from unittest.mock import patch

from app import create_app, db
from app.models.candidate import Candidate
from app.schemas.ai import MatchExplanationOutput
from app.services.groq_client import GroqService, ProviderResult
from app.services.vector_service import VectorService


class TestAIHardening(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()

    def test_provider_rate_limit_is_classified_without_logging_details(self):
        class RateLimitError(Exception):
            status_code = 429

            def __str__(self):
                return "private provider response body"

        class FakeLLM:
            def invoke(self, _messages):
                raise RateLimitError()

        with patch("config.Config.AI_PROVIDER", "groq"), patch("config.Config.GROQ_API_KEY", "server-side-test-key"), patch.object(GroqService, "get_llm", return_value=FakeLLM()), patch("config.Config.GROQ_FALLBACK_MODEL", ""):
            result = GroqService.call_llm_result("job related test prompt")
        self.assertEqual(result.provider_status, "rate_limited")
        self.assertEqual(result.fallback_reason, "provider_rate_limited")

    def test_malformed_or_schema_invalid_llm_output_is_rejected(self):
        with patch.object(GroqService, "call_llm_result", return_value=ProviderResult("{bad json", "available")):
            malformed = GroqService.call_structured_result("prompt", "system", MatchExplanationOutput)
        self.assertIsNone(malformed.data)
        self.assertEqual(malformed.provider_status, "invalid_output")
        with patch.object(GroqService, "call_llm_result", return_value=ProviderResult('{"key_strengths": [], "key_concerns": [], "rationale": ""}', "available")):
            invalid = GroqService.call_structured_result("prompt", "system", MatchExplanationOutput)
        self.assertIsNone(invalid.data)
        self.assertEqual(invalid.fallback_reason, "schema_validation_failed")

    def test_huggingface_gpt_oss_provider_uses_server_token_and_reports_model(self):
        class FakeCompletion:
            choices = [type("Choice", (), {"message": type("Message", (), {"content": "Paris"})()})()]

        class FakeCompletions:
            def __init__(self):
                self.request = None

            def create(self, **kwargs):
                self.request = kwargs
                return FakeCompletion()

        class FakeClient:
            def __init__(self):
                self.chat = type("Chat", (), {"completions": FakeCompletions()})()

        fake_client = FakeClient()
        with patch("config.Config.AI_PROVIDER", "huggingface"), \
             patch("config.Config.HF_TOKEN", "server-only-test-token"), \
             patch("config.Config.HF_MODEL", "openai/gpt-oss-120b"), \
             patch("config.Config.HF_PROVIDER", "fireworks-ai"), \
             patch.object(GroqService, "get_hf_client", return_value=fake_client):
            result = GroqService.call_llm_result("What is the capital of France?", "Answer briefly.")

        request = fake_client.chat.completions.request
        self.assertEqual(result.text, "Paris")
        self.assertEqual(result.provider_status, "available")
        self.assertEqual(result.provider, "huggingface")
        self.assertEqual(result.model, "openai/gpt-oss-120b")
        self.assertEqual(request["messages"][0]["role"], "system")
        self.assertEqual(request["messages"][1]["content"], "What is the capital of France?")
        self.assertNotIn("server-only-test-token", repr(result))

    def test_huggingface_rate_limit_returns_safe_status_without_falling_through_to_groq(self):
        class RateLimitError(Exception):
            status_code = 429

            def __str__(self):
                return "private provider response"

        class FakeCompletions:
            def create(self, **_kwargs):
                raise RateLimitError()

        class FakeClient:
            chat = type("Chat", (), {"completions": FakeCompletions()})()

        with patch("config.Config.AI_PROVIDER", "huggingface"), \
             patch("config.Config.HF_TOKEN", "server-only-test-token"), \
             patch.object(GroqService, "get_hf_client", return_value=FakeClient()), \
             patch.object(GroqService, "get_llm") as groq_client:
            result = GroqService.call_llm_result("test prompt")

        self.assertEqual(result.provider_status, "rate_limited")
        self.assertEqual(result.fallback_reason, "provider_rate_limited")
        self.assertEqual(result.provider, "huggingface")
        groq_client.assert_not_called()

    def test_huggingface_missing_token_is_explicit_provider_unavailable(self):
        with patch("config.Config.AI_PROVIDER", "huggingface"), patch("config.Config.HF_TOKEN", ""), patch.object(GroqService, "get_hf_client") as client:
            result = GroqService.call_llm_result("test prompt")
        self.assertEqual(result.provider_status, "unavailable")
        self.assertEqual(result.fallback_reason, "missing_api_key")
        self.assertEqual(result.provider, "huggingface")
        client.assert_not_called()

    def test_no_embedding_provider_returns_explicit_lexical_fallback(self):
        service = object.__new__(VectorService)
        service.embedding_fn = None
        result = service.compute_similarity("Python Flask engineer", "Python engineer")
        self.assertEqual(result["method"], "lexical_overlap_fallback")
        self.assertEqual(result["provider_status"], "unavailable")
        self.assertEqual(result["fallback_reason"], "embedding_not_configured")

    def test_stale_vector_ids_are_excluded(self):
        class Collection:
            current_candidate_id = None

            def count(self):
                return 2

            def query(self, **_kwargs):
                return {"ids": [[f"candidate_{self.current_candidate_id}", "candidate_999999"]], "distances": [[0.1, 0.01]], "metadatas": [[{}, {}]]}

        with self.app.app_context():
            candidate = Candidate(name="Vector Test Candidate")
            db.session.add(candidate)
            db.session.commit()
            service = object.__new__(VectorService)
            service.embedding_fn = lambda _documents: [[0.1, 0.2]]
            service.resume_collection = Collection()
            service.resume_collection.current_candidate_id = candidate.id
            results = service.find_top_candidates_for_job("Python", n_results=2)
            self.assertEqual([item["candidate_id"] for item in results], [candidate.id])
            db.session.delete(candidate)
            db.session.commit()

    def test_matching_components_are_reproducible(self):
        from app.graphs.matching_graph import explainable_recommendation_node, experience_scoring_node, skill_matching_node, vector_similarity_node

        state = {
            "candidate_text": "Python Flask API developer",
            "job_text": "Python Flask API engineer",
            "required_skills": ["Python", "Flask"],
            "candidate_skills": ["Python", "Flask"],
            "job_experience_min": 3.0,
            "candidate_experience": 4.0,
            "candidate_experience_known": True,
            "job_title": "Backend Engineer",
            "provider_status": "unavailable",
        }
        similarity = {"score": 83.2, "method": "local_chroma_cosine", "provider_status": "available", "fallback_reason": None}
        with patch.object(VectorService, "compute_similarity", return_value=similarity), patch.object(GroqService, "call_structured_result", return_value=type("Result", (), {"data": None, "provider_status": "unavailable", "fallback_reason": "missing_api_key"})()):
            outputs = []
            for _ in range(2):
                combined = {**state, **vector_similarity_node(state)}
                combined.update(skill_matching_node(combined))
                combined.update(experience_scoring_node(combined))
                outputs.append(explainable_recommendation_node(combined))
        for key in ("overall_score", "recommendation", "key_strengths", "key_concerns", "rationale", "score_weights"):
            self.assertEqual(outputs[0][key], outputs[1][key])


if __name__ == "__main__":
    unittest.main()
