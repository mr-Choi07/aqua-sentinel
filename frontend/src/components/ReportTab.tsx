import { useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ImagePlus, RotateCcw, X } from "lucide-react";
import type { AnalyzeReportResult, RiskResult } from "../api";
import { analyzeDamagePhoto, fetchOfficialPdf, fetchSummaryPdf } from "../api";

interface Props {
  selectedRisk: RiskResult | null;
  species: string;
  onBack: () => void;
}

export default function ReportTab({ selectedRisk, species, onBack }: Props) {
  const [owner, setOwner] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [farmName, setFarmName] = useState("");
  const [farmAreaHa, setFarmAreaHa] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeReportResult | null>(null);

  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryUrl, setSummaryUrl] = useState<string | null>(null);

  const [generatingOfficial, setGeneratingOfficial] = useState(false);
  const [officialError, setOfficialError] = useState<string | null>(null);
  const [officialUrl, setOfficialUrl] = useState<string | null>(null);

  const backButton = (
    <button
      onClick={onBack}
      className="tap-target flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-lg font-bold"
      style={{ color: "var(--text-primary)" }}
    >
      <ArrowLeft size={24} />
      홈으로
    </button>
  );

  if (!selectedRisk) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        {backButton}
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
          어장을 먼저 선택해주세요.
        </p>
      </div>
    );
  }

  function handleFile(file: File | null) {
    setPhoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function runAnalysis() {
    if (!selectedRisk) return;
    if (!photo) {
      setAnalyzeError("사진을 업로드해주세요.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    setResult(null);
    setSummaryUrl(null);
    setOfficialUrl(null);
    try {
      const res = await analyzeDamagePhoto({ sta_cde: selectedRisk.sta_cde, species, photo });
      setResult(res);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runAnalysis();
  }

  function buildParams(res: AnalyzeReportResult) {
    return {
      request_id: res.request_id,
      photo_filename: res.photo_filename,
      sta_cde: selectedRisk!.sta_cde,
      species,
      owner,
      contact,
      address,
      farm_name: farmName,
      farm_area_ha: farmAreaHa,
      license_no: licenseNo,
      risk: res.risk,
      analysis: res.analysis,
    };
  }

  async function handleSummaryPdf() {
    if (!result) return;
    setGeneratingSummary(true);
    setSummaryError(null);
    try {
      const blob = await fetchSummaryPdf(buildParams(result));
      setSummaryUrl(URL.createObjectURL(blob));
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : String(e));
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleOfficialPdf() {
    if (!result) return;
    setGeneratingOfficial(true);
    setOfficialError(null);
    try {
      const blob = await fetchOfficialPdf(buildParams(result));
      setOfficialUrl(URL.createObjectURL(blob));
    } catch (e) {
      setOfficialError(e instanceof Error ? e.message : String(e));
    } finally {
      setGeneratingOfficial(false);
    }
  }

  const inputClass = "w-full rounded-xl border px-4 py-3 text-lg";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" };
  const labelClass = "block text-lg font-bold mb-2";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      {backButton}

      <h2 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
        피해가 있어요
      </h2>

      <div
        className="flex items-start gap-2 rounded-2xl p-4 text-base leading-relaxed"
        style={{ background: "color-mix(in srgb, var(--warning) 16%, transparent)", color: "var(--text-primary)" }}
      >
        <AlertTriangle size={20} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
        <span>
          이 문서는 AI가 만든 <strong>초안</strong>이에요. 실제 신고·보험 청구는 공식 서식과
          기관 확인이 필요해요. AI는 사진에서 보이는 것만 설명할 뿐, 보상 여부나 금액을
          정하지 않아요.
        </span>
      </div>

      <p
        className="text-base rounded-2xl p-4"
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
      >
        대상 어장: <strong style={{ color: "var(--text-primary)" }}>{selectedRisk.region}</strong>
        {" · "}어종: {species}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
          1. 어업인 정보
        </p>
        <div>
          <label className={labelClass}>어업인명</label>
          <input className={inputClass} style={inputStyle} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>연락처</label>
          <input
            className={inputClass}
            style={inputStyle}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="010-0000-0000"
          />
        </div>

        <div>
          <label className={labelClass}>어장 소재지</label>
          <input
            className={inputClass}
            style={inputStyle}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`비워두면 "${selectedRisk.region}"으로 표시돼요`}
          />
        </div>

        <p className="mt-2 text-base font-bold" style={{ color: "var(--text-muted)" }}>
          2. 피해 내용
        </p>
        <div>
          <label className={labelClass}>어장명</label>
          <input
            className={inputClass}
            style={inputStyle}
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>양식 면적(ha)</label>
          <input
            className={inputClass}
            style={inputStyle}
            value={farmAreaHa}
            onChange={(e) => setFarmAreaHa(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>어업면허/신고번호</label>
          <input
            className={inputClass}
            style={inputStyle}
            value={licenseNo}
            onChange={(e) => setLicenseNo(e.target.value)}
          />
        </div>

        <p
          className="rounded-xl p-3 text-base"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          "피해물량-확정"과 "피해 구분"은 담당 공무원이 직접 확인 후 적는 항목이라
          자동으로 채우지 않아요.
        </p>

        <div>
          <label className={labelClass}>폐사 사진</label>
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
              className="tap-target flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-lg font-semibold transition-colors hover:border-solid"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <ImagePlus size={32} style={{ color: "var(--text-muted)" }} />
              <span>눌러서 사진 선택</span>
              <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
                JPG, PNG, WEBP
              </span>
            </button>
          ) : (
            <div
              className="flex items-center gap-3 rounded-2xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              {previewUrl && (
                <img src={previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
              )}
              <span className="flex-1 truncate text-lg" style={{ color: "var(--text-primary)" }}>
                {photo.name}
              </span>
              <button
                type="button"
                onClick={() => handleFile(null)}
                className="tap-target rounded-lg p-2"
                style={{ color: "var(--text-muted)" }}
                aria-label="사진 제거"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={analyzing}
          className="tap-target w-full rounded-2xl px-5 py-4 text-lg font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)", minHeight: 56 }}
        >
          {analyzing ? "사진 분석 중..." : "사진 분석하기"}
        </button>
      </form>

      {analyzeError && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl p-4 text-lg font-semibold"
          style={{ background: "color-mix(in srgb, var(--critical) 14%, transparent)", color: "var(--critical)" }}
        >
          <span>{analyzeError}</span>
          <button
            type="button"
            onClick={runAnalysis}
            className="tap-target flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-base font-bold text-white"
            style={{ background: "var(--critical)" }}
          >
            <RotateCcw size={16} />
            재시도
          </button>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          {result.inconsistent && (
            <div
              className="flex items-start gap-2 rounded-2xl p-4 text-lg font-bold"
              style={{ background: "color-mix(in srgb, var(--critical) 16%, transparent)", color: "var(--critical)" }}
            >
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <span>
                관측 수온은 정상 범위지만 사진은 대량 폐사로 보여요. 서로 다를 수 있으니
                신고 전 꼭 다시 확인해주세요.
              </span>
            </div>
          )}

          <div
            className="rounded-2xl border p-5 text-lg"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
          >
            <p className="mb-2 text-base font-bold" style={{ color: "var(--text-muted)" }}>
              AI 사진 분석 결과
            </p>
            <p className="mb-1">
              <strong>피해물량(AI 추정):</strong> {result.analysis.quantity_estimate}
            </p>
            <p className="mb-2">
              <strong>피해 원인(AI 추정):</strong> {result.analysis.cause_estimate}
            </p>
            <p style={{ color: "var(--text-secondary)" }}>{result.analysis.full_observation}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSummaryPdf}
              disabled={generatingSummary}
              className="tap-target flex-1 rounded-2xl px-5 py-4 text-lg font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--good)", minHeight: 56 }}
            >
              {generatingSummary ? "생성 중..." : "참고용 요약본 보기"}
            </button>
            <button
              type="button"
              onClick={handleOfficialPdf}
              disabled={generatingOfficial}
              className="tap-target flex-1 rounded-2xl px-5 py-4 text-lg font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent)", minHeight: 56 }}
            >
              {generatingOfficial ? "생성 중..." : "공식 서식에 맞춰 보기"}
            </button>
          </div>

          {summaryError && (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl p-4 text-lg font-semibold"
              style={{ background: "color-mix(in srgb, var(--critical) 14%, transparent)", color: "var(--critical)" }}
            >
              <span>{summaryError}</span>
              <button
                type="button"
                onClick={handleSummaryPdf}
                className="tap-target flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-base font-bold text-white"
                style={{ background: "var(--critical)" }}
              >
                <RotateCcw size={16} />
                재시도
              </button>
            </div>
          )}
          {summaryUrl && (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl p-4"
              style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)" }}
            >
              <span className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--good)" }}>
                <CheckCircle2 size={22} />
                참고용 요약본이 생성됐어요
              </span>
              <a
                href={summaryUrl}
                download="damage_report_summary.pdf"
                className="tap-target rounded-xl px-4 py-2.5 text-base font-bold text-white"
                style={{ background: "var(--good)" }}
              >
                PDF 다운로드
              </a>
            </div>
          )}

          {officialError && (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl p-4 text-lg font-semibold"
              style={{ background: "color-mix(in srgb, var(--critical) 14%, transparent)", color: "var(--critical)" }}
            >
              <span>{officialError}</span>
              <button
                type="button"
                onClick={handleOfficialPdf}
                className="tap-target flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-base font-bold text-white"
                style={{ background: "var(--critical)" }}
              >
                <RotateCcw size={16} />
                재시도
              </button>
            </div>
          )}
          {officialUrl && (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl p-4"
              style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
            >
              <span className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--accent)" }}>
                <CheckCircle2 size={22} />
                공식 서식(제출용)이 생성됐어요
              </span>
              <a
                href={officialUrl}
                download="damage_report_official.pdf"
                className="tap-target rounded-xl px-4 py-2.5 text-base font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                PDF 다운로드
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
