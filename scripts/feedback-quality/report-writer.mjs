import fs from "node:fs/promises";
import path from "node:path";

export async function writeReport(report, reportDir) {
  await fs.mkdir(reportDir, { recursive: true });

  const timestamp = report.finishedAt.replace(/[:.]/g, "-");
  const prettyReport = `${JSON.stringify(report, null, 2)}\n`;
  const timestampedPath = path.join(reportDir, `feedback-quality-${timestamp}.json`);
  const latestPath = path.join(reportDir, "latest.json");

  await fs.writeFile(timestampedPath, prettyReport, "utf8");
  await fs.writeFile(latestPath, prettyReport, "utf8");

  return { timestampedPath, latestPath };
}
