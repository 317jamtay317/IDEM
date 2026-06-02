using RecordKeeping.Domain.Common;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Common;

public class EntityTests
{
    [Fact]
    public void Entities_WithSameId_AreEqual_RegardlessOfAttributes()
    {
        var id = Guid.NewGuid();
        var a = new Customer(id, "Alice");
        var b = new Customer(id, "Bob");

        a.Equals(b).ShouldBeTrue();
        (a == b).ShouldBeTrue();
        (a != b).ShouldBeFalse();
        a.GetHashCode().ShouldBe(b.GetHashCode());
    }

    [Fact]
    public void Entities_WithDifferentId_AreNotEqual()
    {
        var a = new Customer(Guid.NewGuid(), "Alice");
        var b = new Customer(Guid.NewGuid(), "Alice");

        a.Equals(b).ShouldBeFalse();
        (a == b).ShouldBeFalse();
        (a != b).ShouldBeTrue();
    }

    [Fact]
    public void Entities_OfDifferentType_WithSameId_AreNotEqual()
    {
        var id = Guid.NewGuid();
        var customer = new Customer(id, "Alice");
        var product = new Product(id);

        customer.Equals(product).ShouldBeFalse();
    }

    [Fact]
    public void Entity_IsNotEqualToNull()
    {
        var customer = new Customer(Guid.NewGuid(), "Alice");

        customer.Equals(null).ShouldBeFalse();
        (customer == null).ShouldBeFalse();
        (null == customer).ShouldBeFalse();
    }

    // Test doubles — concrete entities used to exercise identity-based equality.
    private sealed class Customer(Guid id, string name) : Entity<Guid>(id)
    {
        public string Name { get; } = name;
    }

    private sealed class Product(Guid id) : Entity<Guid>(id);
}
