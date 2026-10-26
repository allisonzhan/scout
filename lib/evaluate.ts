import { Evaluation, Posting, Profile } from "./domain";
export function evaluate(
  job: Posting,
  p: Profile,
  now = new Date(),
): Evaluation {
  const reasons: string[] = [],
    unknowns: string[] = [],
    evidence: Evaluation["evidence"] = [];
  let conflict = false,
    ambiguous = false;
  const text = job.description,
    combined = `${job.title}. ${text}`;
  const cite = (rule: string, match: RegExpMatchArray | null) => {
    if (match) evidence.push({ rule, quote: match[0] });
  };
  const fail = (message: string) => {
    conflict = true;
    reasons.push(message);
  };
  if (job.closed) fail("This posting is no longer listed by its source.");
  if (job.deadline && new Date(job.deadline) < now)
    fail("The stated application deadline has passed.");
  const senior = job.title.match(
    /\b(senior|sr\.?|staff|principal|lead|director|manager)\b/i,
  );
  if (senior && !/\b(intern|internship)\b/i.test(job.title)) {
    fail("This is a senior or leadership position.");
    cite("Seniority", senior);
  }
  const years = [
    ...text.matchAll(
      /(?:at least |minimum(?: of)? |requires? |must have )?(\d+)\+?(?:\s*[-–]\s*\d+)?\s+years?\s+(?:of\s+)?(?:professional|industry|full[- ]time|relevant|software|engineering|work|experience)[^.;\n]{0,65}/gi,
    ),
  ];
  for (const y of years) {
    cite("Experience", y);
    const context = text.slice(
      Math.max(0, y.index! - 70),
      y.index! + y[0].length + 40,
    );
    if (
      /preferred|nice to have|bonus/i.test(context) &&
      !/requires?|must have|minimum|at least/i.test(y[0])
    )
      continue;
    if (
      /or equivalent|equivalent experience|exception|internships? (?:count|included|accepted)|academic (?:experience|projects)/i.test(
        text.slice(Math.max(0, y.index! - 80), y.index! + y[0].length + 100),
      )
    ) {
      ambiguous = true;
      reasons.push(
        "Experience requirement includes an equivalency that needs review.",
      );
    } else if (p.professionalYears === null)
      unknowns.push("Professional employment duration is not confirmed.");
    else if (Number(y[1]) > p.professionalYears)
      fail(
        `Requires ${y[1]} years of relevant professional experience; profile records ${p.professionalYears}.`,
      );
  }
  const degree = text.match(
    /(?:completed|earned|must (?:hold|have)|requires? (?:a )?)[^.;\n]{0,25}(?:bachelor|master|ph\.?d)|(?:bachelor|master|ph\.?d)[^.;\n]{0,35}(?:degree required|degree is required)/i,
  );
  if (degree) {
    cite("Degree", degree);
    if (p.completedDegree === false)
      fail(
        "A completed degree is required; the profile confirms no completed degree.",
      );
    else if (p.completedDegree === null)
      unknowns.push("Completed degree eligibility needs confirmation.");
  }
  const enrollment = text.match(
    /currently (?:enrolled|pursuing)|enrolled in|pursuing (?:a |an )?(?:bachelor|undergraduate)/i,
  );
  if (enrollment) {
    cite("Enrollment", enrollment);
    if (p.enrolled === false) fail("Current enrollment is required.");
    else if (p.enrolled === null)
      unknowns.push("Enrollment has not been confirmed.");
  }
  const grad = text.match(
    /graduat(?:e|ing|ion)[^.;\n]{0,65}?(20\d{2})(?:\s*(?:-|–|to|and|or|through)\s*(20\d{2}))?/i,
  );
  if (grad) {
    cite("Graduation", grad);
    if (!p.graduationYear)
      unknowns.push("Graduation year has not been supplied.");
    else {
      const end = Number(grad[2] || grad[1]);
      if (p.graduationYear < Number(grad[1]) || p.graduationYear > end)
        fail("Graduation year conflicts with the posting.");
    }
  }
  const full =
      /full[ -]?time/i.test(job.employment || "") ||
      /\bfull[ -]time\b/i.test(text),
    part =
      /part[ -]?time/i.test(job.employment || "") ||
      /\bpart[ -]time\b/i.test(text);
  const hours = text.match(
    /(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*hours?\s*(?:per|a|\/)\s*week/i,
  );
  const summer = /\bsummer\b/i.test(combined);
  if (full && part) {
    ambiguous = true;
    reasons.push("Both full-time and part-time schedules are mentioned.");
  }
  if (p.period === "semester" && full && !part)
    fail("Full-time work exceeds the selected semester availability.");
  if (p.period === "semester" && summer) {
    ambiguous = true;
    reasons.push("Summer timing needs review against semester preferences.");
  }
  if (hours) {
    cite("Hours", hours);
    if (Number(hours[2] || hours[1]) > p.maxHours)
      fail(`Stated hours exceed your ${p.maxHours}-hour weekly limit.`);
  } else unknowns.push("Weekly hours are not explicitly verified.");
  const remote = job.workplace?.toLowerCase() === "remote",
    onsite = /onsite|on-site|hybrid/i.test(job.workplace || "");
  if (p.remoteOnly && onsite)
    fail("The posting requires on-site or hybrid work.");
  if (!job.workplace) unknowns.push("Workplace arrangement is unknown.");
  if (remote || job.location)
    unknowns.push(
      "Confirm geographic eligibility and any remote location restrictions.",
    );
  const auth = text.match(
    /(?:must|require[d]?).{0,40}(?:authorized to work|work authorization|citizen)|(?:u\.?s\.?|united states) citizenship[^.;\n]{0,25}required/i,
  );
  if (auth) {
    cite("Authorization", auth);
    if (/citizen/i.test(auth[0])) {
      if (!p.citizenship)
        unknowns.push("Required citizenship has not been supplied.");
      else {
        ambiguous = true;
        reasons.push(
          "Review the stated citizenship requirement against your profile.",
        );
      }
    } else if (p.authorized === false)
      fail("Required work authorization conflicts with the profile.");
    else if (p.authorized === null)
      unknowns.push("Required work authorization is not confirmed.");
  }
  // Free-form postings are never certified solely by the absence of a regex match.
  unknowns.push("Unstructured mandatory requirements need human verification.");
  if (!job.deadline) unknowns.push("Application deadline is not published.");
  const matchedSkills = p.skills.filter((s) =>
    combined.toLowerCase().includes(s.toLowerCase()),
  );
  const w = p.weights;
  const components = {
    eligibility: conflict
      ? 0
      : ambiguous
        ? Math.round(w.eligibility * 0.25)
        : Math.round(w.eligibility * 0.5),
    technical: Math.round(
      w.technical *
        (p.skills.length ? matchedSkills.length / p.skills.length : 0),
    ),
    learning:
      /\b(mentor|mentorship|training program|learn from|professional development|learning opportunities)\b/i.test(
        text,
      )
        ? w.learning
        : 0,
    schedule:
      hours && Number(hours[2] || hours[1]) <= p.maxHours && !conflict
        ? w.schedule
        : part && !conflict
          ? Math.round(w.schedule * 0.5)
          : 0,
    compensation:
      job.compensation && !/unpaid/i.test(job.compensation)
        ? w.compensation
        : 0,
    interest: p.roles.some((r) =>
      job.title.toLowerCase().includes(r.toLowerCase()),
    )
      ? w.interest
      : 0,
  };
  if (!reasons.length)
    reasons.push(
      "No confirmed conflict detected; review the unknown requirements before applying.",
    );
  return {
    classification: conflict
      ? "Ineligible"
      : ambiguous
        ? "Manual Review Required"
        : "Potentially Eligible",
    score: conflict ? 0 : Object.values(components).reduce((a, b) => a + b, 0),
    reasons,
    unknowns: [...new Set(unknowns)],
    evidence,
    components,
    matchedSkills,
    evaluatedAt: now.toISOString(),
    version: "rules-1",
  };
}
