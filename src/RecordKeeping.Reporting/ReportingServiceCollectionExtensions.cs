using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Application.Reporting;
using RecordKeeping.Reporting.Rendering;

namespace RecordKeeping.Reporting;

/// <summary>
/// Composition-root registration for the Report Engine. Mirrors the other layers' service-collection
/// extensions (e.g. <c>AddRecordKeepingPersistence</c>): it registers the
/// <see cref="IReportRenderer"/> implementation so the Application layer's interface resolves to the
/// QuestPDF renderer without the Api referencing the rendering library directly elsewhere.
/// </summary>
public static class ReportingServiceCollectionExtensions
{
    /// <summary>Registers the Report Engine services.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection, for chaining.</returns>
    public static IServiceCollection AddRecordKeepingReporting(this IServiceCollection services)
    {
        // The renderer is stateless and thread-safe, so a single shared instance is sufficient.
        services.AddSingleton<IReportRenderer, QuestPdfReportRenderer>();
        return services;
    }
}
