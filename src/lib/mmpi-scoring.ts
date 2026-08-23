import {
  MMPI_SCALES,
  CLINICAL_SCALE_ORDER,
  CONTENT_SCALE_ORDER,
  SCALE_INFO,
  type MmpiScale,
} from "@/data/mmpi-scales";
import { MMPI_QUESTIONS } from "@/data/mmpi-questions";

export const TOTAL_QUESTIONS = MMPI_QUESTIONS.length;

export type AnswerValue = "D" | "Y";
export type AnswerMap = Record<number, AnswerValue>;
export type Gender = "male" | "female";

export interface ScaleResult {
  code: string;
  name: string;
  desc: string;
  rawScore: number;
  kCorrection: number;
  rawWithK: number;
  tScore: number;
  level: "high" | "normal" | "low";
  levelLabel: string;
  interpretation: string;
  title: string;
}

export interface MmpiResults {
  gender: Gender;
  unanswered: number;
  answered: number;
  clinical: ScaleResult[];
  content: ScaleResult[];
  plainSummary: string;
  overallSummary: string;
  validityWarning: string | null;
  highScales: string[];
}

function calculateRawScore(scale: MmpiScale, answers: AnswerMap): number {
  let raw = 0;
  for (const item of scale.trueItems) if (answers[item] === "D") raw++;
  for (const item of scale.falseItems) if (answers[item] === "Y") raw++;
  return raw;
}

function getTScore(scale: MmpiScale, rawWithK: number, gender: Gender): number {
  const table = gender === "male" ? scale.maleT : scale.femaleT;
  if (!table || table.length === 0) return 30;
  const idx = Math.round(rawWithK);
  if (idx < 0) {
    for (const v of table) if (v !== null) return v;
    return 30;
  }
  if (idx >= table.length) {
    for (let i = table.length - 1; i >= 0; i--) {
      const v = table[i];
      if (v !== null && v !== undefined) return v;
    }
    return 120;
  }
  const direct = table[idx];
  if (direct !== null && direct !== undefined) return direct;
  for (let i = idx - 1; i >= 0; i--) {
    const v = table[i];
    if (v !== null && v !== undefined) return v;
  }
  for (let i = idx + 1; i < table.length; i++) {
    const v = table[i];
    if (v !== null && v !== undefined) return v;
  }
  return 30;
}

export function getLevel(t: number): "high" | "normal" | "low" {
  if (t >= 70) return "high";
  if (t <= 40) return "low";
  return "normal";
}

export function getLevelLabel(t: number): string {
  if (t >= 80) return "Çok Yüksek";
  if (t >= 70) return "Yüksek";
  if (t >= 60) return "Orta-Yüksek";
  if (t >= 41) return "Normal";
  if (t >= 30) return "Düşük";
  return "Çok Düşük";
}

function scoreScales(order: string[], answers: AnswerMap, gender: Gender, kRaw: number): ScaleResult[] {
  const results: ScaleResult[] = [];
  for (const scaleName of order) {
    let scale: MmpiScale | undefined;
    if (scaleName === "Mf") {
      scale =
        MMPI_SCALES.find((s) => s.name === "Mf" && s.genderSpecific === gender) ??
        MMPI_SCALES.find((s) => s.name === "Mf" && !s.genderSpecific);
    } else {
      scale = MMPI_SCALES.find((s) => s.name === scaleName);
    }
    if (!scale) continue;
    const rawScore = calculateRawScore(scale, answers);
    const kCorrection = scale.kFactor * kRaw;
    const rawWithK = rawScore + kCorrection;
    const tScore = getTScore(scale, rawWithK, gender);
    const level = getLevel(tScore);
    const info = SCALE_INFO[scale.name];
    results.push({
      code: scale.code,
      name: scale.name,
      desc: scale.desc,
      rawScore,
      kCorrection: Math.round(kCorrection * 10) / 10,
      rawWithK: Math.round(rawWithK * 10) / 10,
      tScore,
      level,
      levelLabel: getLevelLabel(tScore),
      interpretation: info ? info[level] : "",
      title: info ? info.name : `${scale.desc} (${scale.name})`,
    });
  }
  return results;
}

function plainSummary(all: ScaleResult[], unanswered: number): string {
  const t: Record<string, number> = {};
  for (const r of all) t[r.name] = r.tScore;
  const validity = ["L", "F", "K"];
  const high = all.filter((r) => r.tScore >= 70 && !validity.includes(r.name));
  const highNames = high.map((r) => r.name);
  const has = (n: string) => highNames.includes(n);

  if (unanswered > 30) {
    return "Çok sayıda soru cevaplanmadığı için bu sonuçlar güvenilir değildir. Test yeniden tamamlanmalıdır.";
  }
  if ((t["F"] ?? 0) >= 90) {
    return "F ölçeği çok yüksek çıkmıştır. Bu durum soruların dikkatsizce cevaplanmış olabileceğini, bilinçli olarak kötü görünme çabasını veya çok ciddi psikolojik sıkıntıyı gösterebilir. Sonuçlar dikkatle değerlendirilmelidir.";
  }
  if ((t["L"] ?? 0) >= 70 && (t["K"] ?? 0) >= 70) {
    return "Geçerlilik ölçekleri, soruların savunmacı bir tutumla cevaplanmış olabileceğini göstermektedir. Kişi kendini olduğundan daha iyi gösterme eğilimindedir. Klinik ölçeklerdeki puanlar gerçek durumu tam olarak yansıtmayabilir.";
  }

  if (high.length === 0) {
    const mild = all.filter((r) => r.tScore >= 60 && r.tScore < 70 && !validity.includes(r.name));
    if (mild.length > 0) {
      return "Genel olarak profiliniz normal sınırlar içindedir. Bazı alanlarda hafif yükselmeler görülmekle birlikte, bunlar klinik olarak anlamlı düzeyde değildir. Günlük yaşamda zaman zaman stres, kaygı veya ruh hali değişimleri yaşıyor olabilirsiniz, ancak bunlar beklenen sınırlar içindedir.";
    }
    return "Profiliniz tüm ölçeklerde normal sınırlar içindedir. Belirgin bir psikolojik sorun göstergesi bulunmamaktadır. Genel ruh sağlığınız iyi görünmektedir.";
  }

  const parts: string[] = [];
  if (has("D") && has("Pt")) {
    parts.push(
      "Belirgin düzeyde kaygı ve depresif belirtiler bir arada görülmektedir. Kendinizi sık sık üzgün, endişeli ve gergin hissediyor olabilirsiniz. Karamsarlık, kararsızlık ve aşırı düşünme eğilimi günlük yaşamınızı olumsuz etkiliyor olabilir.",
    );
  } else if (has("D")) {
    parts.push(
      "Depresif belirtiler ön plandadır. Kendinizi mutsuz, enerjisiz ve umutsuz hissediyor olabilirsiniz. Hayattan zevk almada güçlük, ilgi kaybı ve motivasyon düşüklüğü yaşıyor olabilirsiniz.",
    );
  } else if (has("Pt")) {
    parts.push(
      "Yoğun kaygı ve endişe belirtileri görülmektedir. Sürekli bir şeyler hakkında kaygılanma, mükemmeliyetçilik ve takıntılı düşünceler günlük yaşamınızı zorlaştırıyor olabilir.",
    );
  }
  if (has("Sc")) {
    parts.push(
      "Düşünce yapınızda ve çevrenizdeki insanlarla ilişkilerinizde bazı zorluklar yaşıyor olabilirsiniz. Kendinizi farklı, yalnız veya yanlış anlaşılmış hissedebilirsiniz.",
    );
  }
  if (has("Pa")) {
    parts.push(
      "Çevrenizdeki insanlara karşı belirgin bir güvensizlik ve şüphecilik eğilimi görülmektedir. Bu durum ilişkilerinizi olumsuz etkiliyor olabilir.",
    );
  }
  if (has("Pd")) {
    parts.push(
      "Kurallara ve otoriteye karşı bir çatışma eğilimi görülmektedir. Dürtüsel davranışlar, öfke kontrolünde zorluk veya ilişki sorunları yaşıyor olabilirsiniz.",
    );
  }
  if (has("Hs") && has("Hy")) {
    parts.push(
      "Bedensel yakınmalarınız belirgin düzeydedir. Stres ve duygusal sıkıntılarınızı fiziksel belirtiler (ağrı, halsizlik, mide sorunları vb.) olarak yaşıyor olabilirsiniz.",
    );
  } else if (has("Hs")) {
    parts.push(
      "Sağlık konusunda aşırı kaygı ve bedensel yakınmalar ön plandadır. Fiziksel sağlığınızla ilgili sürekli endişe duyuyor olabilirsiniz.",
    );
  } else if (has("Hy")) {
    parts.push(
      "Stres altında bedensel belirtiler geliştirme eğiliminiz yüksektir. Duygusal sorunlarınızı fiziksel yakınmalar olarak ifade ediyor olabilirsiniz.",
    );
  }
  if (has("Ma")) {
    parts.push(
      "Enerji düzeyiniz ve hareketliliğiniz normalin üzerindedir. Huzursuzluk, aşırı planlar yapma, dürtüsel kararlar ve risk alma eğilimi yaşıyor olabilirsiniz.",
    );
  }
  if (has("Si") || has("SOD")) {
    parts.push(
      "Sosyal ortamlarda belirgin düzeyde rahatsızlık ve çekingenlik yaşıyor olabilirsiniz. Yalnız kalmayı tercih ediyor olabilirsiniz.",
    );
  }
  if (has("ANX") && !has("Pt")) {
    parts.push(
      "İçerik ölçekleri de yüksek düzeyde kaygı belirtileri göstermektedir. Genel bir gerginlik, endişe ve stres hali yaşıyor olabilirsiniz.",
    );
  }
  if (has("ANG")) {
    parts.push(
      "Öfke kontrolünde zorluk yaşıyor olabilirsiniz. Kolay sinirlenme ve sabırsızlık günlük yaşamınızı etkiliyor olabilir.",
    );
  }
  if (has("LSE")) {
    parts.push(
      "Özgüveniniz düşük görünmektedir. Kendinizi yetersiz veya değersiz hissediyor olabilirsiniz.",
    );
  }
  if (has("FAM")) {
    parts.push(
      "Aile ilişkilerinizde belirgin sorunlar yaşıyor olabilirsiniz. Aile içi çatışma veya destek eksikliği hissedebilirsiniz.",
    );
  }
  if (has("WRK")) {
    parts.push(
      "İş ve akademik performansınızda güçlükler yaşıyor olabilirsiniz. Odaklanma zorluğu ve motivasyon düşüklüğü olabilir.",
    );
  }
  if (has("OBS")) {
    parts.push(
      "Takıntılı düşünceler ve kararsızlık yaşıyor olabilirsiniz. Karar vermede zorluk günlük yaşamınızı zorlaştırıyor olabilir.",
    );
  }
  if (has("CYN")) {
    parts.push(
      "İnsanlara karşı genel bir güvensizlik ve olumsuz bakış açısı taşıyor olabilirsiniz.",
    );
  }
  if (has("BIZ")) {
    parts.push(
      "Olağandışı düşünce ve algı deneyimleri bildirilmiştir. Bu alanın klinik bir görüşmeyle değerlendirilmesi önerilir.",
    );
  }
  if (has("HEA")) {
    parts.push("Sağlıkla ilgili yoğun kaygılar ve bedensel yakınmalar bildirilmiştir.");
  }
  if (has("TRT")) {
    parts.push(
      "Yardım almaya ve değişime karşı isteksizlik görülmektedir. Bu durum destek sürecini güçleştirebilir.",
    );
  }
  if (parts.length === 0) {
    parts.push(
      "Bazı ölçeklerde klinik eşik üstü yükselmeler bulunmaktadır. Bu yükselmelerin ayrıntılı bir klinik görüşmeyle değerlendirilmesi önerilir.",
    );
  }
  return parts.join(" ");
}

function overallSummary(all: ScaleResult[]): string {
  const validity = ["L", "F", "K"];
  const clinicalNames = ["Hs", "D", "Hy", "Pd", "Mf", "Pa", "Pt", "Sc", "Ma", "Si"];
  const contentNames = CONTENT_SCALE_ORDER;
  const allHigh = all.filter((r) => r.tScore >= 70 && !validity.includes(r.name));
  const elevated = all.filter((r) => r.tScore >= 65 && r.tScore < 70 && !validity.includes(r.name));

  if (allHigh.length > 0) {
    const hc = allHigh.filter((r) => clinicalNames.includes(r.name)).map((r) => r.name);
    const hk = allHigh.filter((r) => contentNames.includes(r.name)).map((r) => r.name);
    let text = `Toplam ${allHigh.length} ölçekte klinik olarak anlamlı yükselme (T≥70) tespit edilmiştir.`;
    if (hc.length) text += ` Klinik ölçekler: ${hc.join(", ")}.`;
    if (hk.length) text += ` İçerik ölçekleri: ${hk.join(", ")}.`;
    text += " Bu ölçeklerdeki yükselmeler detaylı klinik değerlendirme gerektirebilir.";
    return text;
  }
  if (elevated.length > 0) {
    return `Klinik eşik üstü (T≥70) herhangi bir ölçek bulunmamaktadır. Ancak ${elevated.length} ölçekte orta-yüksek düzeyde (T≥65) puanlar gözlenmektedir: ${elevated
      .map((r) => r.name)
      .join(", ")}.`;
  }
  return "Tüm klinik ve içerik ölçekleri normal sınırlar içindedir. Belirgin bir psikolojik sorun göstergesi bulunmamaktadır.";
}

export function computeResults(answers: AnswerMap, gender: Gender): MmpiResults {
  const kScale = MMPI_SCALES.find((s) => s.code === "K");
  const kRaw = kScale ? calculateRawScore(kScale, answers) : 0;
  const answered = Object.keys(answers).length;
  const unanswered = TOTAL_QUESTIONS - answered;

  const clinical = scoreScales(CLINICAL_SCALE_ORDER, answers, gender, kRaw);
  const content = scoreScales(CONTENT_SCALE_ORDER, answers, gender, kRaw);
  const all = [...clinical, ...content];

  return {
    gender,
    unanswered,
    answered,
    clinical,
    content,
    plainSummary: plainSummary(all, unanswered),
    overallSummary: overallSummary(all),
    validityWarning:
      unanswered > 30
        ? `Uyarı: ${unanswered} soru cevaplanmamış. 30'dan fazla boş soru testin geçerliliğini düşürür.`
        : null,
    highScales: all.filter((r) => r.tScore >= 70 && !["L", "F", "K"].includes(r.name)).map((r) => r.name),
  };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} sa ${m % 60} dk ${s} sn`;
  return `${m} dk ${s} sn`;
}

export function genderLabel(gender: string): string {
  return gender === "male" ? "ERKEK" : "KADIN";
}
