// Resolve one visible text label from an Android uiautomator XML dump. Failing
// on ambiguous labels prevents notification tests from tapping another app.
const label = process.argv[2];
if (!label) throw new Error("Expected an exact Android UI text label.");
let xml = "";
for await (const chunk of process.stdin) xml += chunk;
const matches = [...xml.matchAll(/<node\b[^>]*>/g)]
  .map(([node]) => ({
    text: node.match(/\btext="([^"]*)"/)?.[1],
    bounds: node.match(/\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  }))
  .filter((node) => node.text === label && node.bounds);
if (matches.length !== 1) {
  throw new Error(`Expected one visible '${label}', found ${matches.length}.`);
}
const [, left, top, right, bottom] = matches[0].bounds;
process.stdout.write(
  `${Math.floor((Number(left) + Number(right)) / 2)} ${Math.floor((Number(top) + Number(bottom)) / 2)}\n`
);
