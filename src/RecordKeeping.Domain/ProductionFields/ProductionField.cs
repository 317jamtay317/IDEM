using ErrorOr;
using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.ProductionFields;

/// <summary>
/// One entry in the platform-wide catalog of data points that can be captured on a Record
/// (e.g. "Hot Mix", "Waste Oil"). The catalog is the source of truth for <em>which</em> fields
/// exist; Record values are stored sparsely, keyed by a field's immutable <see cref="PropertyName"/>.
/// </summary>
/// <remarks>
/// Aggregate root, managed by SiteAdmins and shared across every Org — it is not Org-scoped, so
/// I-D03 does not apply to it. Constructed only via <see cref="Create"/>. Per I-D19,
/// <see cref="PropertyName"/> is assigned once at creation and never changes.
/// </remarks>
public sealed class ProductionField : AggregateRoot<Guid>
{
    /// <summary>Maximum permitted length of a <see cref="PropertyName"/>.</summary>
    public const int MaxPropertyNameLength = 200;

    /// <summary>Maximum permitted length of a <see cref="FriendlyName"/>.</summary>
    public const int MaxFriendlyNameLength = 200;

    /// <summary>
    /// The stable, machine-facing key for the field (e.g. <c>HotMix</c>). Required, immutable, and
    /// unique across the catalog (I-D19); Record values are stored keyed by it, so it never changes.
    /// </summary>
    public string PropertyName { get; }

    /// <summary>
    /// The human-facing label shown wherever a user picks or searches for the field (e.g. "Hot Mix").
    /// Editable via <see cref="Rename"/>, and unique among active fields so a search result is
    /// unambiguous (I-D20).
    /// </summary>
    public string FriendlyName { get; private set; }

    /// <summary>The kind of value the field captures.</summary>
    public ProductionFieldDataType DataType { get; private set; }

    /// <summary>Optional help text explaining what the field captures; <see langword="null"/> when unset.</summary>
    public string? Description { get; private set; }

    /// <summary>
    /// Optional grouping used to organise the field picker (e.g. "Mixes", "Fuels &amp; Burners");
    /// <see langword="null"/> when uncategorised.
    /// </summary>
    public string? Category { get; private set; }

    /// <summary>
    /// Whether the field is surfaced in summary views and Reports by default (the legacy
    /// <c>IsSummaryProperty</c>).
    /// </summary>
    public bool IsSummary { get; private set; }

    /// <summary>The field's position in the picker; lower values sort first.</summary>
    public int DisplayOrder { get; private set; }

    /// <summary>
    /// Whether the field is offered for new Records. A retired field (<see langword="false"/>) is kept
    /// so historical Record values keyed to it still resolve, but is no longer presented in the picker.
    /// </summary>
    public bool IsActive { get; private set; }

    private ProductionField(
        Guid id,
        string propertyName,
        string friendlyName,
        ProductionFieldDataType dataType,
        string? description,
        string? category,
        bool isSummary,
        int displayOrder) : base(id)
    {
        PropertyName = propertyName;
        FriendlyName = friendlyName;
        DataType = dataType;
        Description = description;
        Category = category;
        IsSummary = isSummary;
        DisplayOrder = displayOrder;
        IsActive = true;
    }

    /// <summary>
    /// Creates a new Production Field.
    /// </summary>
    /// <param name="propertyName">The immutable machine key, e.g. <c>HotMix</c> (I-D19); required, trimmed.</param>
    /// <param name="friendlyName">The human-facing label, e.g. "Hot Mix"; required, trimmed.</param>
    /// <param name="dataType">The kind of value the field captures.</param>
    /// <param name="description">Optional help text; blank is stored as <see langword="null"/>.</param>
    /// <param name="category">Optional picker grouping; blank is stored as <see langword="null"/>.</param>
    /// <param name="isSummary">Whether the field appears in summaries/Reports by default.</param>
    /// <param name="displayOrder">The field's sort position in the picker.</param>
    /// <returns>The new Production Field, or a validation error when a value is invalid.</returns>
    public static ErrorOr<ProductionField> Create(
        string propertyName,
        string friendlyName,
        ProductionFieldDataType dataType,
        string? description = null,
        string? category = null,
        bool isSummary = false,
        int displayOrder = 0)
    {
        var validatedPropertyName = ValidatePropertyName(propertyName);
        if (validatedPropertyName.IsError)
        {
            return validatedPropertyName.Errors;
        }

        var validatedFriendlyName = ValidateFriendlyName(friendlyName);
        if (validatedFriendlyName.IsError)
        {
            return validatedFriendlyName.Errors;
        }

        return new ProductionField(
            Guid.NewGuid(),
            validatedPropertyName.Value,
            validatedFriendlyName.Value,
            dataType,
            Normalize(description),
            Normalize(category),
            isSummary,
            displayOrder);
    }

    /// <summary>
    /// Updates the editable attributes of the field. The immutable <see cref="PropertyName"/> is never
    /// touched (I-D19); blank <paramref name="description"/> or <paramref name="category"/> is stored as
    /// <see langword="null"/>.
    /// </summary>
    /// <param name="friendlyName">The new human-facing label; required, trimmed.</param>
    /// <param name="dataType">The kind of value the field captures.</param>
    /// <param name="description">Optional help text; blank is stored as <see langword="null"/>.</param>
    /// <param name="category">Optional picker grouping; blank is stored as <see langword="null"/>.</param>
    /// <param name="isSummary">Whether the field appears in summaries/Reports by default.</param>
    /// <param name="displayOrder">The field's sort position in the picker.</param>
    /// <returns>Success, or a validation error when the friendly name is invalid.</returns>
    public ErrorOr<Success> Update(
        string friendlyName,
        ProductionFieldDataType dataType,
        string? description,
        string? category,
        bool isSummary,
        int displayOrder)
    {
        var validatedFriendlyName = ValidateFriendlyName(friendlyName);
        if (validatedFriendlyName.IsError)
        {
            return validatedFriendlyName.Errors;
        }

        // I-D19: PropertyName is intentionally never assigned here — it is immutable.
        FriendlyName = validatedFriendlyName.Value;
        DataType = dataType;
        Description = Normalize(description);
        Category = Normalize(category);
        IsSummary = isSummary;
        DisplayOrder = displayOrder;
        return Result.Success;
    }

    /// <summary>
    /// Retires the field so it is no longer offered for new Records; existing Record values keyed to it
    /// still resolve. Idempotent.
    /// </summary>
    public void Retire() => IsActive = false;

    /// <summary>Reactivates a retired field so it is offered for new Records again. Idempotent.</summary>
    public void Reactivate() => IsActive = true;

    private static ErrorOr<string> ValidatePropertyName(string propertyName)
    {
        if (string.IsNullOrWhiteSpace(propertyName))
        {
            // I-D19: a Production Field's PropertyName is required.
            return Error.Validation("I-D19", "PropertyName is required for a Production Field.");
        }

        var trimmed = propertyName.Trim();
        if (trimmed.Length > MaxPropertyNameLength)
        {
            return Error.Validation(
                "ProductionField.PropertyName.TooLong",
                $"PropertyName cannot exceed {MaxPropertyNameLength} characters.");
        }

        return trimmed;
    }

    private static ErrorOr<string> ValidateFriendlyName(string friendlyName)
    {
        if (string.IsNullOrWhiteSpace(friendlyName))
        {
            return Error.Validation(
                "ProductionField.FriendlyName.Empty",
                "FriendlyName is required for a Production Field.");
        }

        var trimmed = friendlyName.Trim();
        if (trimmed.Length > MaxFriendlyNameLength)
        {
            return Error.Validation(
                "ProductionField.FriendlyName.TooLong",
                $"FriendlyName cannot exceed {MaxFriendlyNameLength} characters.");
        }

        return trimmed;
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
