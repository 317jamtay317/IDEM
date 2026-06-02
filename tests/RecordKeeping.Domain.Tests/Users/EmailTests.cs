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

    [Fact]
    public void Emails_WithSameValue_AreEqual()
    {
        var a = Email.Create("user@example.com").Value;
        var b = Email.Create("user@example.com").Value;

        a.ShouldBe(b);
        (a == b).ShouldBeTrue();
        a.GetHashCode().ShouldBe(b.GetHashCode());
    }

    [Fact]
    public void Emails_WithDifferentValue_AreNotEqual()
    {
        var a = Email.Create("user@example.com").Value;
        var b = Email.Create("other@example.com").Value;

        a.ShouldNotBe(b);
        (a != b).ShouldBeTrue();
    }
}
