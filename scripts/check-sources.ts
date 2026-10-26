import { fetchBoard } from "../lib/sources";
for (const source of [
  { provider: "greenhouse" as const, board: "anthropic", company: "Anthropic" },
  { provider: "lever" as const, board: "palantir", company: "Palantir" },
  { provider: "ashby" as const, board: "notion", company: "Notion" },
]) {
  try {
    const jobs = await fetchBoard(source);
    console.log(
      JSON.stringify({
        provider: source.provider,
        company: source.company,
        count: jobs.length,
        sample: jobs[0]?.title,
      }),
    );
  } catch (e) {
    console.error(source.provider, e);
    process.exitCode = 1;
  }
}
