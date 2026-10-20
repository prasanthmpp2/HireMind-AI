import { type ChangeEvent, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Wand2 } from "lucide-react";
import Cropper, { Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { ResumeData } from "../../types/resume";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";

type PersonalSectionProps = {
  form: UseFormReturn<ResumeData>;
  onImproveSummary: () => void;
  loading: boolean;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Invalid image format"));
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });

const resizePhoto = (dataUrl: string, maxDimension = 320) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const longestSide = Math.max(image.width, image.height);
      const ratio = longestSide > maxDimension ? maxDimension / longestSide : 1;
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Image processing failed"));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = dataUrl;
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });

const cropPhoto = async (source: string, croppedAreaPixels: Area) => {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round(croppedAreaPixels.width));
  const height = Math.max(1, Math.round(croppedAreaPixels.height));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image processing failed");
  }

  context.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    width,
    height
  );

  return canvas.toDataURL("image/jpeg", 0.9);
};

export const PersonalSection = ({ form, onImproveSummary, loading }: PersonalSectionProps) => {
  const {
    register,
    setValue,
    setError,
    clearErrors,
    formState: { errors }
  } = form;
  const summaryValue = form.watch("personal.summary") ?? "";
  const photoValue = form.watch("personal.photo") ?? "";
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropError, setCropError] = useState("");
  const [isCropOpen, setIsCropOpen] = useState(false);

  const closeCropDialog = () => {
    setIsCropOpen(false);
    setCropSource(null);
    setCropError("");
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setError("personal.photo", { type: "manual", message: "Please upload a JPG, PNG, or WebP image." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("personal.photo", { type: "manual", message: "Photo must be smaller than 10 MB." });
      return;
    }

    try {
      clearErrors("personal.photo");
      const rawData = await fileToDataUrl(file);
      setCropSource(rawData);
      setIsCropOpen(true);
    } catch (_error) {
      setError("personal.photo", { type: "manual", message: "Could not process photo. Try another file." });
    }
  };

  const handleCropConfirm = async () => {
    if (!cropSource || !croppedAreaPixels) {
      setCropError("Please set your crop area first.");
      return;
    }

    try {
      setCropError("");
      const cropped = await cropPhoto(cropSource, croppedAreaPixels);
      const optimized = await resizePhoto(cropped);
      setValue("personal.photo", optimized, { shouldDirty: true, shouldValidate: true });
      closeCropDialog();
    } catch (_error) {
      setCropError("Photo crop failed. Please try another image.");
    }
  };

  return (
    <SectionCard title="Personal Details" description="Introduce yourself and your professional brand.">
      {isCropOpen && cropSource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCropDialog(); }}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="resume-photo-dialog-title">
            <h3 id="resume-photo-dialog-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">Crop Photo</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Adjust the crop area and click OK.
            </p>
            <div className="relative mt-3 h-[320px] overflow-hidden rounded-xl bg-black">
              <Cropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full accent-teal-600"
              />
            </div>
            {cropError ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{cropError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCropDialog}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                className="rounded-full bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full Name" required error={errors.personal?.name?.message}>
          <input
            {...register("personal.name")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
            placeholder="Jane Doe"
          />
        </Field>
        <Field label="Email" required error={errors.personal?.email?.message}>
          <input
            {...register("personal.email")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
            placeholder="jane@example.com"
          />
        </Field>
        <Field label="Phone" required error={errors.personal?.phone?.message}>
          <input
            {...register("personal.phone")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
            placeholder="+1 555 555 5555"
          />
        </Field>
        <Field label="Address" error={errors.personal?.address?.message}>
          <input
            {...register("personal.address")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
            placeholder="City, State"
          />
        </Field>
        <Field label="LinkedIn" error={errors.personal?.linkedin?.message}>
          <input
            {...register("personal.linkedin")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
            placeholder="linkedin.com/in/username"
          />
        </Field>
        <Field label="GitHub" error={errors.personal?.github?.message}>
          <input
            {...register("personal.github")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
            placeholder="github.com/username"
          />
        </Field>
        <Field label="Photo URL (Optional)" error={errors.personal?.photo?.message}>
          <input
            {...register("personal.photo")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
            placeholder="https://example.com/profile-photo.jpg"
          />
        </Field>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
        <label htmlFor="resume-photo-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Upload Photo (Optional)
        </label>
        <input
          id="resume-photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handlePhotoUpload}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-500 dark:text-slate-300"
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Recommended: square JPG or PNG. This photo appears in your resume header.
        </p>
        {photoValue ? (
          <div className="mt-3 flex items-center gap-3">
            <img
              src={photoValue}
              alt="Resume profile preview"
              className="h-14 w-14 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
            />
            <button
              type="button"
              onClick={() =>
                setValue("personal.photo", "", {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Remove Photo
            </button>
          </div>
        ) : null}
      </div>
      <Field
        label={`About (${summaryValue.length}/500)`}
        error={errors.personal?.summary?.message}
      >
        <textarea
          {...register("personal.summary")}
          maxLength={500}
          rows={5}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
          placeholder="Results-focused professional with strong experience in..."
        />
      </Field>
      <button
        type="button"
        onClick={onImproveSummary}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full border border-teal-500 px-4 py-2 text-sm font-medium text-teal-600 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
      >
        <Wand2 className="h-4 w-4" />
        Improve About with AI
      </button>
    </SectionCard>
  );
};
