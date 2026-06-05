namespace RecordKeeping.Application.Reporting;

/// <summary>
/// The server-side sample <see cref="ReportDataContext"/> the Report Builder's Preview renders
/// against. It mirrors the front-end's <c>SAMPLE_DATA_CONTEXT</c> — Rieth-Riley's Goshen plant for a
/// calendar year, with three Production Field detail rows — so every binding the sample template
/// authors both resolves and previews cleanly. Used while the Report Builder is SiteAdmin-only and
/// has no Org context; a real Org-scoped Report run supplies a context built from real Records.
/// </summary>
public static class SampleReportData
{
    /// <summary>
    /// Builds a fresh sample <see cref="ReportDataContext"/>. The <see cref="ReportDataContext.Page"/>
    /// is a placeholder (page 1 of 1); the layout engine overrides it per page from the template's
    /// page count.
    /// </summary>
    /// <returns>A new sample <see cref="ReportDataContext"/>.</returns>
    public static ReportDataContext CreateContext() => new(
        Scopes: new Dictionary<string, IReadOnlyDictionary<string, string>>
        {
            ["Org"] = new Dictionary<string, string> { ["Name"] = "Rieth-Riley Construction Co." },
            ["Facility"] = new Dictionary<string, string>
            {
                ["Name"] = "Goshen Asphalt Plant",
                ["PermitNumber"] = "IN-018-00042",
            },
            ["Report"] = new Dictionary<string, string>
            {
                ["Year"] = "2025",
                ["Date"] = "March 12, 2026",
            },
            ["SubReport"] = new Dictionary<string, string> { ["opacity_detail"] = "(opacity readings)" },
        },
        DetailScope: "Record",
        Detail: new IReadOnlyDictionary<string, string>[]
        {
            new Dictionary<string, string> { ["Field"] = "Hot Mix", ["Tons"] = "1280.5", ["Limit"] = "2000" },
            new Dictionary<string, string> { ["Field"] = "Cold Mix", ["Tons"] = "642.25", ["Limit"] = "1000" },
            new Dictionary<string, string> { ["Field"] = "Steel Slag", ["Tons"] = "318", ["Limit"] = "500" },
        },
        Page: new ReportPageContext(1, 1));
}
