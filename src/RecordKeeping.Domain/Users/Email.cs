using ErrorOr;

namespace RecordKeeping.Domain.Users;

/// <summary>
/// Validated email address used as the canonical identifier for a User.
/// </summary>
/// <remarks>
/// Constructed only via <see cref="Create"/>; instances are immutable.
/// </remarks>
public sealed class Email
{
    /// <summary>The validated email string.</summary>
    public string Value { get; }

    private Email(string value) => Value = value;

    /// <summary>
    /// Validates <paramref name="value"/> and returns an <see cref="Email"/>
    /// when it is well-formed.
    /// </summary>
    /// <param name="value">The candidate email string.</param>
    /// <returns>
    /// The <see cref="Email"/> on success; a validation error otherwise.
    /// </returns>
    public static ErrorOr<Email> Create(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return Error.Validation("Email.Empty", "Email cannot be empty.");
        }

        if (!value.Contains('@'))
        {
            return Error.Validation("Email.Invalid", "Email is not in a valid format.");
        }

        return new Email(value);
    }
}
