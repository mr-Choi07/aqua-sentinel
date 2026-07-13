import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, X } from "lucide-react";
import type { RiskResult } from "../api";
import { submitDamageReport } from "../api";

interface Props {
  riskData: RiskResult[];
  species: string;
}

export default function ReportTab({ riskData, species }: Props) {
  const [station, setStation] = useState(riskData[0]?.sta_cde ?? "");
  const [owner, setOwner] = useState("");
  const [farmName, setFarmName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (riskData.length === 0) {
    return (
      <p style={{ color: "var(--text-secondary)" }}>
        위험도 데이터가 없어 보고서를 생성할 수 없습니다.
      </p>
    );
  }

  function handleFile(file: File | null) {
    setPhoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      setError("사진을 업로드해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    try {
      const blob = await submitDamageReport({
        sta_cde: station || riskData[0].sta_cde,
        species,
        owner,
        farm_name: farmName,
        photo,
      });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        실제 신고 서식이 아니며, 신고 준비를 돕는 참고 자료입니다. 호출 시에만 Claude API를
        사용합니다.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">관측소</label>
          <select
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            value={station}
            onChange={(e) => setStation(e.target.value)}
          >
            {riskData.map((r) => (
              <option key={r.sta_cde} value={r.sta_cde}>
                {r.region}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">어업인명</label>
          <input
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">어장명</label>
          <input
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">폐사 사진</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {!photo ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-sm transition-colors hover:border-solid"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <ImagePlus size={28} style={{ color: "var(--text-muted)" }} />
              <span className="font-medium">클릭해서 사진 선택</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                JPG, PNG, WEBP
              </span>
            </button>
          ) : (
            <div
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              {previewUrl && (
                <img src={previewUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
              )}
              <span className="flex-1 truncate text-sm">{photo.name}</span>
              <button
                type="button"
                onClick={() => handleFile(null)}
                className="rounded-md p-1.5"
                style={{ color: "var(--text-muted)" }}
                aria-label="사진 제거"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)" }}
        >
          {loading ? "사진 분석 및 보고서 생성 중..." : "보고서 생성"}
        </button>
      </form>

      {error && <p className="mt-3" style={{ color: "var(--critical)" }}>{error}</p>}
      {pdfUrl && (
        <div
          className="mt-4 flex items-center justify-between rounded-lg p-4"
          style={{ background: "color-mix(in srgb, var(--good) 10%, transparent)" }}
        >
          <span
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: "var(--good)" }}
          >
            <CheckCircle2 size={18} />
            보고서가 생성되었습니다
          </span>
          <a
            href={pdfUrl}
            download="damage_report.pdf"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
            style={{ background: "var(--good)" }}
          >
            PDF 다운로드
          </a>
        </div>
      )}
    </div>
  );
}
