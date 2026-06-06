namespace RecordKeeping.Application.Reporting;

/// <summary>
/// The most recent rendered state of a Report Template being previewed live: one raster image (PNG)
/// per page, in page order. Held per editing session so a watcher who opens the live preview
/// mid-build is shown the current report immediately, without waiting for the next edit.
/// </summary>
/// <param name="Pages">The rendered page images (PNG bytes), in page order.</param>
public sealed record ReportPreviewSnapshot(IReadOnlyList<byte[]> Pages);
