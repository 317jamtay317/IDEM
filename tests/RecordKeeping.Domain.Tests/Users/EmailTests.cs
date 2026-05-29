using ErrorOr;
using RecordKeeping.Domain.Users;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Users;

public class EmailTests
{
    [Fact]
    public void Create_WithValidEmail_ReturnsEmail()
    {
        var result = Email.Create("user@example.com");

        result.IsError.ShouldBeFalse();
        result.Value.Value.ShouldBe("user@example.com");
    }

    [Fact]
    public void Create_WithMissingAtSign_ReturnsValidationError()
    {
        var result = Email.Create("not-an-email");

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithEmptyOrWhitespace_ReturnsValidationError(string value)
    {
        var result = Email.Create(value);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }
}
