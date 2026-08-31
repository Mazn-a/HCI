/**
 * HCIFlow — مصدر واحد لتسلسل المتعلّم (HCI: visibility, consistency, recognition)
 *
 * التسلسل الإجباري للمبتدئ:
 *   زائر → تسجيل → اختيار المسار → (مقدمة للمهتم) → ابدأ هنا → مقال تعريفي → مسارات 1…7
 *
 * المتخصص/المدير يتجاوزون البداية والمقدمة.
 */
(function (global) {
  'use strict';

  var PHASE = {
    GUEST: 'guest',
    PATH_CHOICE: 'path_choice',
    INTRO: 'intro',
    FOUNDATION: 'foundation',
    PATHS_START: 'paths_start',
    PATHS_CONTINUE: 'paths_continue',
    COMPLETE: 'complete',
    SPECIALIST: 'specialist',
    ADMIN: 'admin'
  };

  /** شريط التسلسل الظاهر في دليل المسارات */
  var RAIL = [
    { id: 'account', label: 'الحساب' },
    { id: 'start', label: 'البداية' },
    { id: 'paths', label: 'المسارات' }
  ];

  function firstName(user, fallback) {
    var particles = { 'ال': 1, 'آل': 1, 'بن': 1, 'ابن': 1, 'بنت': 1, 'أبو': 1, 'ابو': 1, 'أم': 1, 'ام': 1 };
    function pick(raw) {
      var parts = String(raw || '').trim().split(/\s+/).filter(Boolean);
      var i;
      var part;
      var clean;
      for (i = 0; i < parts.length; i++) {
        part = parts[i];
        clean = part.replace(/[^\u0600-\u06FFa-zA-Z]/g, '');
        if ((clean === 'ال' || clean === 'آل') && parts[i + 1]) continue;
        if (clean.length >= 2 && !particles[clean]) return part;
      }
      return '';
    }
    if (typeof user === 'string') return pick(user) || pick(fallback);
    var fromUser = pick(user && user.firstName) || pick(user && user.fullName);
    if (fromUser) return fromUser;
    return pick(fallback);
  }

  /**
   * يحدد مرحلة المتعلّم الحالية — يُستدعى من الصفحات بعد معرفة التقدّم.
   * @param {object|null} user
   * @param {{ foundationDone?: boolean, doneCount?: number, journeyTotal?: number }} opts
   */
  function getPhase(user, opts) {
    opts = opts || {};
    if (!user) return PHASE.GUEST;
    if (user.role === 'admin') return PHASE.ADMIN;
    if (user.pathType === 'specialist') return PHASE.SPECIALIST;
    if (!user.pathType) return PHASE.PATH_CHOICE;
    if (user.pathType === 'curious' && !user.introSeen) return PHASE.INTRO;
    if (!opts.foundationDone) return PHASE.FOUNDATION;
    var total = opts.journeyTotal || 7;
    var done = opts.doneCount || 0;
    if (done >= total) return PHASE.COMPLETE;
    if (done === 0) return PHASE.PATHS_START;
    return PHASE.PATHS_CONTINUE;
  }

  /** أي خطوة في الشريط مكتملة / حالية */
  function railState(phase) {
    var accountDone = phase !== PHASE.GUEST;
    var startDone = [
      PHASE.PATHS_START,
      PHASE.PATHS_CONTINUE,
      PHASE.COMPLETE,
      PHASE.SPECIALIST,
      PHASE.ADMIN
    ].indexOf(phase) !== -1;
    var pathsActive = startDone;
    var current = 'account';
    if (phase === PHASE.GUEST) current = 'account';
    else if (
      phase === PHASE.PATH_CHOICE ||
      phase === PHASE.INTRO ||
      phase === PHASE.FOUNDATION
    ) {
      current = 'start';
    } else {
      current = 'paths';
    }
    return {
      account: accountDone ? (current === 'account' ? 'current' : 'done') : 'current',
      start: !accountDone
        ? 'locked'
        : startDone
          ? current === 'start'
            ? 'current'
            : 'done'
          : current === 'start'
            ? 'current'
            : 'locked',
      paths: pathsActive
        ? current === 'paths'
          ? phase === PHASE.COMPLETE
            ? 'done'
            : 'current'
          : 'locked'
        : 'locked'
    };
  }

  /**
   * نصوص دليل المسارات حسب المرحلة — خطاب يحترم حالة المستخدم (state-aware).
   */
  function pathGuideCopy(phase, ctx) {
    ctx = ctx || {};
    var name = ctx.firstName || '';
    var num = ctx.stageNum || '';
    var title = ctx.stageTitle || '';
    var done = ctx.doneCount || 0;

    switch (phase) {
      case PHASE.GUEST:
        return {
          sectionEyebrow: '/// رحلتك في المنصة',
          sectionTitle: 'سبعة مسارات مرتّبة من البداية حتى الإتقان',
          sectionLead:
            'بعد إنشاء الحساب تُوجَّه إلى مسارك مباشرة.',
          kicker: 'للزائر',
          title: 'ابدأ بإنشاء حساب',
          hint: 'الحساب يحفظ تقدّمك. بعد التسجيل نوجّهك إلى مكانك مباشرة.',
          cta: 'إنشاء حساب والبدء ←',
          ctaHref: 'auth.html?tab=signup',
          secondary: 'استعرض المسارات السبعة',
          secondaryHref: '#paths',
          hideSecondary: false
        };

      case PHASE.PATH_CHOICE:
        return {
          sectionEyebrow: '/// خطوتك الآن',
          sectionTitle: name ? name + '، اختر مسارك' : 'اختر مسارك',
          sectionLead: 'حدّد إن كنت تبدأ من الصفر أو تتجاوز المقدمة.',
          kicker: 'مطلوب الآن',
          title: 'اختيار المسار',
          hint: 'مهتم بالتخصص أو متخصص — بعدها نكمّل من مكانك الصحيح.',
          cta: 'اختيار المسار ←',
          ctaHref: 'path-choice.html',
          hideSecondary: true
        };

      case PHASE.INTRO:
        return {
          sectionEyebrow: '/// خطوتك الآن',
          sectionTitle: name ? name + '، اقرأ المقدمة' : 'اقرأ المقدمة',
          sectionLead: 'قبل المسارات: فهم سريع لماهية التخصص ولماذا يهم.',
          kicker: 'المقدمة',
          title: 'مقدمة HCI',
          hint: 'اقرأ بهدوء، ثم ابدأ صفحة البداية والمقال التعريفي.',
          cta: 'متابعة المقدمة ←',
          ctaHref: 'intro.html',
          hideSecondary: true
        };

      case PHASE.FOUNDATION:
        return {
          sectionEyebrow: '/// خطوتك الآن',
          sectionTitle: name
            ? name + '، أكمل البداية قبل المسارات'
            : 'أكمل البداية قبل المسارات',
          sectionLead:
            'أنت مسجّل الدخول. اقرأ المقال التعريفي، ثم يُفتح المسار الأول.',
          kicker: 'مطلوب قبل المسارات',
          title: 'المقال التعريفي',
          hint: 'مقال قصير عن تخصص HCI. بعده تنتقل للمسارات.',
          cta: 'متابعة البداية ←',
          ctaHref: 'foundation.html',
          hideSecondary: true
        };

      case PHASE.COMPLETE:
        return {
          sectionEyebrow: '/// أحسنت',
          sectionTitle: 'أكملت المسارات السبعة',
          sectionLead: 'يمكنك مراجعة أي مسار، أو فتح الشهادة من ملفك الشخصي.',
          kicker: 'مكتمل',
          title: 'الرحلة مكتملة',
          hint: 'راجع أي محطة للمراجعة، أو اطبع شهادتك من الملف الشخصي.',
          cta: 'عرض الشهادة ←',
          ctaHref: 'certificate.html',
          secondary: 'الملف الشخصي',
          secondaryHref: 'profile.html',
          hideSecondary: false
        };

      case PHASE.SPECIALIST:
      case PHASE.ADMIN:
        return {
          sectionEyebrow: phase === PHASE.ADMIN ? '/// لوحة الإدارة' : '/// مسار المتخصص',
          sectionTitle: 'وصول كامل — ابدأ من حيث تحتاج',
          sectionLead:
            'تجاوزت البداية والاستكشاف. لا تسلسل إجباري: راجع درساً، أو انتقل للترميز والدورات والأدوات.',
          kicker: phase === PHASE.ADMIN ? 'مدير المنصة' : 'متخصص في المجال',
          title: 'المسارات والأدوات مفتوحة',
          hint: 'اختر البطاقة التي تخدم عملك الآن. لست ملزماً بالبدء من «اكتشف التخصص».',
          cta: 'إلى الدورات والأدوات ←',
          ctaHref: 'courses.html',
          hideSecondary: true
        };

      case PHASE.PATHS_START:
        return {
          sectionEyebrow: '/// مساراتك',
          sectionTitle: 'جاهز للمسار الأول',
          sectionLead:
            'أتممت البداية. ابدأ بالمسار الذهبي أدناه — كل مسار يُفتح بعد إكمال الذي قبله.',
          kicker: 'خطوتك التالية · المسار ' + num + ' من 7',
          title: title,
          hint: 'ابدأ بالمسار المميّز أدناه. بعد إكماله يُفتح التالي تلقائياً.',
          cta: 'بدء المسار ←',
          ctaHref: ctx.stageHref || 'discover.html',
          hideSecondary: true
        };

      case PHASE.PATHS_CONTINUE:
      default:
        return {
          sectionEyebrow: '/// مساراتك',
          sectionTitle: 'سبعة مسارات — مرحلتك الحالية موضّحة أدناه',
          sectionLead:
            'كل مسار يُفتح بعد إكمال الذي قبله. البطاقة الذهبية تشير إلى موضعك الحالي.',
          kicker: 'خطوتك التالية · المسار ' + num + ' من 7',
          title: title,
          hint: 'أنجزت ' + done + ' من 7. تابع المسار الذهبي — هذه مرحلتك الحالية.',
          cta: 'متابعة المسار ←',
          ctaHref: ctx.stageHref || 'discover.html',
          hideSecondary: true
        };
    }
  }

  function applyPathGuide(copy) {
    if (!copy) return;
    var eyebrow = document.getElementById('pathsSectionEyebrow');
    var title = document.getElementById('pathsSectionTitle');
    var lead = document.getElementById('pathsSectionLead');
    var guideTitle = document.getElementById('pathGuideTitle');
    var guideHint = document.getElementById('pathGuideHint');
    var guideCta = document.getElementById('pathGuideCta');
    var guideKicker = document.getElementById('pathGuideKicker');
    var guideProfile = document.getElementById('pathGuideProfile');

    if (eyebrow && copy.sectionEyebrow) eyebrow.textContent = copy.sectionEyebrow;
    if (title && copy.sectionTitle) title.textContent = copy.sectionTitle;
    if (lead && copy.sectionLead) lead.textContent = copy.sectionLead;
    if (guideKicker) guideKicker.textContent = copy.kicker || '';
    if (guideTitle) guideTitle.textContent = copy.title || '';
    if (guideHint) guideHint.textContent = copy.hint || '';
    if (guideCta) {
      guideCta.textContent = copy.cta || '';
      if (copy.ctaHref) guideCta.setAttribute('href', copy.ctaHref);
    }
    if (guideProfile) {
      if (copy.hideSecondary) {
        guideProfile.hidden = true;
        guideProfile.classList.add('js-guest-only');
      } else {
        guideProfile.hidden = false;
        guideProfile.classList.remove('js-guest-only');
        guideProfile.textContent = copy.secondary || '';
        if (copy.secondaryHref) guideProfile.setAttribute('href', copy.secondaryHref);
      }
    }
  }

  function renderFlowRail(phase) {
    var rail = document.getElementById('flowRail');
    if (!rail) return;
    var state = railState(phase);
    rail.querySelectorAll('[data-flow]').forEach(function (li) {
      var id = li.getAttribute('data-flow');
      var st = state[id] || 'locked';
      li.classList.remove('is-done', 'is-current', 'is-locked');
      if (st === 'done') li.classList.add('is-done');
      else if (st === 'current') li.classList.add('is-current');
      else li.classList.add('is-locked');
    });
    rail.hidden = false;
  }

  global.HCIFlow = {
    PHASE: PHASE,
    RAIL: RAIL,
    firstName: firstName,
    getPhase: getPhase,
    railState: railState,
    pathGuideCopy: pathGuideCopy,
    applyPathGuide: applyPathGuide,
    renderFlowRail: renderFlowRail
  };
})(typeof window !== 'undefined' ? window : this);
