using System.Globalization;
using RecordKeeping.Reporting.Model;

namespace RecordKeeping.Reporting.Layout;

/// <summary>
/// Resolves a footer page-number format to the concrete string shown on a given page, the C# port of
/// <c>formatPageNumber</c> in <c>src/client/src/app/reportBuilder/pageNumbers.ts</c>.
/// </summary>
internal static class PageNumberFormatter
{
    /// <summary>
    /// Resolves <paramref name="options"/>'s format for a page: <c>{n}</c> becomes the current page
    /// number and <c>{N}</c> the total, each offset so the first page counts as
    /// <see cref="PageNumberOptions.StartAt"/>. Every occurrence is substituted; literal text is left
    /// untouched.
    /// </summary>
    /// <param name="options">The page-number options (only <c>Format</c> and <c>StartAt</c> are used).</param>
    /// <param name="currentPage">The 1-based index of the page being rendered.</param>
    /// <param name="totalPages">The number of pages in the document.</param>
    /// <returns>The resolved page-number string.</returns>
    public static string Format(PageNumberOptions options, int currentPage, int totalPages)
    {
        var offset = options.StartAt - 1;
        var current = (currentPage + offset).ToString(CultureInfo.InvariantCulture);
        var total = (totalPages + offset).ToString(CultureInfo.InvariantCulture);
        return options.Format.Replace("{n}", current).Replace("{N}", total);
    }
}
