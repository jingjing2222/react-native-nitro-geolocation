const deadline = Date.now() + 15_000;

while (Date.now() < deadline) {
  // Keep Maestro blocked so native background receivers get processing time.
}
