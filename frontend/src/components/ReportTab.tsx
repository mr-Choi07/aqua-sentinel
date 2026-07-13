import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, X } from "lucide-react";
import type { RiskResult } from "../api";
import { submitDamageReport } from "../api";

interface Props {
  selectedRisk: RiskResult | null;
  species: string;
}

export default function ReportTab({ selectedRisk, species }: Props) {
  const [owner, setOwner] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [farmName, setFarmName] = useState("");
  const [farmAreaHa, setFarmAreaHa] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedRisk) {
    return (
      <p style={{ color: "var(--text-secondary)" }}>
        위험도 데이터가 없어 신고서 초안을 생성할 수 없습니다.
      </p>
    );
  }

  function handleFile(file: File | null) {
    setPhoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRisk) return;
    if (!photo) {
      setError("사진을 업로드해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    try {
      const blob = await submitDamageReport({
        sta_cde: selectedRisk.sta_cde,
        species,
        owner,
        contact,
        address,
        farm_name: farmName,
        farm_area_ha: farmAreaHa,
        license_no: licenseNo,
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
      <div
        className="mb-4 flex items-start gap-2 rounded-lg p-3 text-xs leading-relaxed"
        style={{ background: "rgba(250,178,25,0.12)", color: "#8a5c00" }}
      >
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          본 자료는 AI가 생성한 <strong>초안</strong>이며, 실제 신고·보험 청구 시 공식 서식과
          기관 확인이 필요합니다. AI는 사진에서 관찰되는 소견만 서술할 뿐, 보상 여부나 금액을
          판단하지 않습니다.
        </span>
      </div>

      <p
        className="text-sm mb-4 rounded-lg p-3"
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
      >
        대상 어장: <strong style={{ color: "var(--text-primary)" }}>{selectedRisk.region}</strong>
        {" · "}어종: {species} {" · "}호출 시에만 Claude API를 사용합니다.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          1. 어업인 정보
        </p>
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
          <label className="block text-sm font-medium mb-1.5">연락처</label>
          <input
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="010-0000-0000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">어장 소재지</label>
          <input
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`비워두면 "${selectedRisk.region}"으로 표시됩니다`}
          />
        </div>

        <p
          className="mt-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          2. 피해 내용
        </p>
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
          <label className="block text-sm font-medium mb-1.5">양식 면적(ha)</label>
          <input
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            value={farmAreaHa}
            onChange={(e) => setFarmAreaHa(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">어업면허/신고번호</label>
          <input
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            value={licenseNo}
            onChange={(e) => setLicenseNo(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 rounded-md p-2 text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
            "피해물량-확정"과 "피해 구분"은 담당 공무원의 현지 확인이 필요한 항목이라
            자동으로 채우지 않습니다.
          </p>
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
          {loading ? "사진 분석 및 초안 생성 중..." : "신고서 초안 생성"}
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
            초안이 생성되었습니다
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
