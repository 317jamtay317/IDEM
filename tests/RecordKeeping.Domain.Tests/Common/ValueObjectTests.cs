using RecordKeeping.Domain.Common;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Common;

public class ValueObjectTests
{
    [Fact]
    public void Equals_WithSameComponents_AreEqual()
    {
        var a = new Money(10m, "USD");
        var b = new Money(10m, "USD");

        a.Equals(b).ShouldBeTrue();
        (a == b).ShouldBeTrue();
        (a != b).ShouldBeFalse();
        a.GetHashCode().ShouldBe(b.GetHashCode());
    }

    [Fact]
    public void Equals_WithDifferentComponents_AreNotEqual()
    {
        var a = new Money(10m, "USD");
        var b = new Money(10m, "EUR");

        a.Equals(b).ShouldBeFalse();
        (a == b).ShouldBeFalse();
        (a != b).ShouldBeTrue();
    }

    [Fact]
    public void Equals_WithDifferentValueObjectType_IsFalse()
    {
        var money = new Money(10m, "USD");
        var color = new Color("USD");

        money.Equals(color).ShouldBeFalse();
    }

    [Fact]
    public void Equals_WithNonValueObject_IsFalse()
    {
        var money = new Money(10m, "USD");

        money.Equals("not a value object").ShouldBeFalse();
    }

    [Fact]
    public void Equals_WithNull_IsFalse()
    {
        var money = new Money(10m, "USD");

        money.Equals(null).ShouldBeFalse();
        (money == null).ShouldBeFalse();
        (null == money).ShouldBeFalse();
    }

    [Fact]
    public void TwoNulls_AreEqual()
    {
        Money? left = null;
        Money? right = null;

        (left == right).ShouldBeTrue();
    }

    // Test doubles — concrete value objects used to exercise the base contract.
    private sealed class Money(decimal amount, string currency) : ValueObject
    {
        public decimal Amount { get; } = amount;

        public string Currency { get; } = currency;

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Amount;
            yield return Currency;
        }
    }

    private sealed class Color(string name) : ValueObject
    {
        public string Name { get; } = name;

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Name;
        }
    }
}
