// Offline script writer. Not AI: it structures the user's own words with narrative templates.
// With a long text (text → video), it splits the text into scenes. With a short idea, it fills a template.
import type { Brief } from '../types';
import type { RawScene, RawScript } from './script-shared';
import { sceneCountFor } from './script-shared';
import { mulberry, strHash } from '../util';

type L = 'fr' | 'en' | 'es' | 'ar';
const lang = (b: Brief): L => (b.language.startsWith('en') ? 'en' : b.language.startsWith('es') ? 'es' : b.language.startsWith('ar') ? 'ar' : 'fr');

const T: Record<L, Record<string, string[]>> = {
  fr: {
    hook: ['Et si {s} changeait tout ?', 'Personne ne vous a jamais expliqué {s} comme ça.', 'Voici ce que vous ignorez sur {s}.', '{S} : 30 secondes pour tout comprendre.'],
    context: ['Tout commence avec une question simple : pourquoi {s} compte autant ?', 'Pour comprendre {s}, il faut revenir à l’essentiel.'],
    point: ['Premier point clé : {p}.', 'Ensuite : {p}.', 'Et surtout : {p}.', 'À retenir : {p}.'],
    points: ['ce que c’est vraiment', 'pourquoi c’est important', 'comment en profiter', 'l’erreur à éviter', 'le détail qui change tout'],
    conclusion: ['Voilà pourquoi {s} mérite votre attention.', 'Maintenant, vous voyez {s} autrement.'],
    cta: ['Abonnez-vous pour la suite !', 'Partagez cette vidéo à quelqu’un qui doit la voir.', 'Dites-nous en commentaire ce que vous en pensez.'],
    adProblem: ['Vous aussi, vous en avez assez de perdre du temps ?', 'Le problème ? Tout le monde fait comme avant.'],
    adSolution: ['Découvrez {p}.', 'La solution s’appelle {p}.'],
    adBenefit: ['Simple, rapide et efficace.', 'Pensé pour vous, testé au quotidien.', '{u}'],
    adOffer: ['{o}'],
    story: ['Il était une fois, {s}.', 'Un jour, tout bascule.', 'Il faut alors faire un choix.', 'Et c’est là que tout change.', 'Depuis, plus rien n’est pareil.'],
  },
  en: {
    hook: ['What if {s} changed everything?', 'Nobody ever explained {s} like this.', 'Here is what you don’t know about {s}.', '{S}: everything in 30 seconds.'],
    context: ['It all starts with one simple question: why does {s} matter?', 'To understand {s}, let’s go back to basics.'],
    point: ['Key point one: {p}.', 'Next: {p}.', 'And most of all: {p}.', 'Remember: {p}.'],
    points: ['what it really is', 'why it matters', 'how to make the most of it', 'the mistake to avoid', 'the detail that changes everything'],
    conclusion: ['That is why {s} deserves your attention.', 'Now you see {s} differently.'],
    cta: ['Subscribe for more!', 'Share this with someone who needs it.', 'Tell us what you think in the comments.'],
    adProblem: ['Tired of wasting time?', 'The problem? Everyone still does it the old way.'],
    adSolution: ['Meet {p}.', 'The answer is {p}.'],
    adBenefit: ['Simple, fast and effective.', 'Built for you, tested every day.', '{u}'],
    adOffer: ['{o}'],
    story: ['Once upon a time, {s}.', 'One day, everything changes.', 'A choice has to be made.', 'And that is when it all turns around.', 'Since then, nothing is the same.'],
  },
  es: {
    hook: ['¿Y si {s} lo cambiara todo?', 'Nadie te ha explicado {s} así.', 'Esto es lo que no sabes sobre {s}.'],
    context: ['Todo empieza con una pregunta: ¿por qué importa {s}?'],
    point: ['Primer punto clave: {p}.', 'Después: {p}.', 'Y sobre todo: {p}.'],
    points: ['qué es realmente', 'por qué importa', 'cómo aprovecharlo', 'el error que debes evitar'],
    conclusion: ['Por eso {s} merece tu atención.'], cta: ['¡Suscríbete para más!', 'Compártelo con alguien.'],
    adProblem: ['¿Cansado de perder tiempo?'], adSolution: ['Descubre {p}.'], adBenefit: ['Simple, rápido y eficaz.', '{u}'], adOffer: ['{o}'],
    story: ['Había una vez {s}.', 'Un día, todo cambia.', 'Hay que elegir.', 'Y entonces todo cambia.', 'Desde entonces, nada es igual.'],
  },
  ar: {
    hook: ['ماذا لو غيّر {s} كل شيء؟', 'لم يشرح لك أحد {s} بهذه الطريقة.'],
    context: ['كل شيء يبدأ بسؤال بسيط: لماذا {s} مهم؟'],
    point: ['النقطة الأولى: {p}.', 'ثم: {p}.', 'والأهم: {p}.'],
    points: ['ما هو حقًا', 'لماذا هو مهم', 'كيف تستفيد منه', 'الخطأ الذي يجب تجنبه'],
    conclusion: ['لهذا يستحق {s} اهتمامك.'], cta: ['اشترك للمزيد!', 'شارك الفيديو.'],
    adProblem: ['هل سئمت من إضاعة الوقت؟'], adSolution: ['اكتشف {p}.'], adBenefit: ['بسيط وسريع وفعّال.', '{u}'], adOffer: ['{o}'],
    story: ['كان يا ما كان، {s}.', 'وفي يوم ما، تغيّر كل شيء.', 'كان لا بد من الاختيار.', 'وهنا تغيّر كل شيء.', 'ومنذ ذلك الحين، لا شيء كما كان.'],
  },
};

function sentences(text: string) {
  return text.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter((s) => s.length > 2) ?? [];
}

function shortText(s: string, max = 8) {
  const w = s.replace(/[.!?…:;]+$/, '').split(/\s+/);
  return w.length <= max ? w.join(' ') : w.slice(0, max).join(' ') + '…';
}

function keywordsOf(s: string) {
  return s.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}%]/gu, '')).filter((w) => w.length > 5).sort((a, b) => b.length - a.length).slice(0, 2);
}

const CAMS = ['push-in', 'pan-right', 'pull-out', 'tilt-up', 'pan-left', 'orbit', 'push-in', 'dolly-zoom'];
const TRS = ['crossfade', 'slide-left', 'zoom', 'wipe', 'fade', 'slide-up', 'flash', 'blur'];

export function offlineScript(b: Brief, styleName: string): RawScript {
  const L = lang(b), t = T[L], r = mulberry(strHash(b.idea + b.subject));
  const pickOne = (arr: string[]) => arr[Math.floor(r() * arr.length)];
  const subject = (b.subject || b.idea.split(/[.!?\n]/)[0] || 'ce sujet').trim().replace(/[.!?]+$/, '');
  const fill = (s: string, extra: Record<string, string> = {}) =>
    s.replace(/\{s\}/g, subject.charAt(0).toLowerCase() + subject.slice(1)).replace(/\{S\}/g, subject.charAt(0).toUpperCase() + subject.slice(1))
      .replace(/\{p\}/g, extra.p ?? '').replace(/\{u\}/g, extra.u ?? '').replace(/\{o\}/g, extra.o ?? '');
  const n = sceneCountFor(b.durationSec);
  const per = b.durationSec / n;
  const scenes: RawScene[] = [];
  const visualBase = `${subject}, ${styleName}`;
  const sents = sentences(b.idea);

  const push = (narration: string, layout: string, onScreen?: string, sfx: string[] = []) => {
    const i = scenes.length;
    scenes.push({
      title: shortText(onScreen ?? narration, 5), layout, narration, onScreenText: onScreen ?? shortText(narration),
      visual: `${visualBase}, scene ${i + 1}: ${shortText(narration, 14)}`, duration: per,
      camera: CAMS[i % CAMS.length], transition: TRS[i % TRS.length], music: i === 0 ? 'intro' : 'build', sfx,
      keywords: keywordsOf(onScreen ?? narration),
    });
  };

  if (sents.length >= Math.max(3, n - 1)) {
    // Text → video: the user's own text, split into balanced scenes.
    const groups: string[][] = Array.from({ length: n }, () => []);
    sents.forEach((s, i) => groups[Math.min(n - 1, Math.floor((i * n) / sents.length))].push(s));
    groups.filter((g) => g.length).forEach((g, i, arr) => push(g.join(' '), i === 0 ? 'title' : i === arr.length - 1 ? 'cta' : /\d/.test(g[0]) ? 'stat' : 'statement', undefined, i === 0 ? ['riser'] : ['whoosh']));
  } else if (b.mode === 'ad' || b.ad?.product) {
    const ad = b.ad ?? { product: subject, brand: '', offer: '', cta: '', usp: '' };
    const prod = ad.brand ? `${ad.product} de ${ad.brand}` : ad.product || subject;
    push(fill(pickOne(t.hook)), 'title', undefined, ['riser']);
    push(fill(pickOne(t.adProblem)), 'statement', undefined, ['whoosh']);
    push(fill(pickOne(t.adSolution), { p: prod }), 'image', prod, ['impact']);
    const benefits = (ad.usp ? ad.usp.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean) : []).slice(0, 3);
    push(benefits.length ? benefits.join('. ') + '.' : fill(t.adBenefit[0]), 'list', benefits.length ? benefits.join('\n') : undefined, ['pop']);
    while (scenes.length < n - 2) push(fill(t.adBenefit[1]), 'statement', undefined, ['swoosh']);
    if (ad.offer) push(ad.offer, 'stat', ad.offer, ['ding']);
    push(ad.cta || fill(pickOne(t.cta)), 'cta', ad.cta || undefined, ['impact']);
  } else if (b.mode === 'animation') {
    t.story.forEach((s, i) => { if (scenes.length < n) push(fill(s), i === 0 ? 'title' : 'image', undefined, i === 0 ? ['shimmer'] : ['whoosh']); });
    while (scenes.length < n) push(fill(t.story[3]), 'image');
  } else {
    push(fill(pickOne(t.hook)), 'title', undefined, ['riser']);
    if (sents[0] && sents[0] !== subject) push(sents[0], 'statement', undefined, ['whoosh']);
    else push(fill(pickOne(t.context)), 'statement', undefined, ['whoosh']);
    const pts = [...t.points];
    let k = 0;
    while (scenes.length < n - 2) {
      const p = pts[k % pts.length];
      push(fill(t.point[k % t.point.length], { p }), k === 1 ? 'list' : 'statement', k === 1 ? pts.slice(0, 3).join('\n') : shortText(p), ['swoosh']);
      k++;
    }
    push(fill(pickOne(t.conclusion)), 'quote', undefined, ['shimmer']);
    push(fill(pickOne(t.cta)), 'cta', undefined, ['impact']);
  }
  return { title: subject, scenes, characters: [] };
}
