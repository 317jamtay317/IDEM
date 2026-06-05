using RecordKeeping.Infrastructure.Persistence;
using Shouldly;

namespace RecordKeeping.Infrastructure.Tests.ProductionFields;

public class ProductionFieldSeedDataTests
{
    [Fact]
    public void Create_ProducesTheCatalog()
    {
        var fields = ProductionFieldSeedData.Create();

        // The legacy PlantPollution record carries ~60 measurable fields; sanity-check we seeded a catalog.
        fields.Count.ShouldBeGreaterThan(40);
    }

    [Fact]
    public void Create_AllFieldsAreActive()
    {
        ProductionFieldSeedData.Create().ShouldAllBe(field => field.IsActive);
    }

    [Fact]
    [Trait("Invariant", "I-D21")]
    public void Create_HasNoDuplicatePropertyNames()
    {
        var duplicates = ProductionFieldSeedData.Create()
            .GroupBy(field => field.PropertyName, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        duplicates.ShouldBeEmpty();
    }

    [Fact]
    [Trait("Invariant", "I-D22")]
    public void Create_HasNoDuplicateFriendlyNames()
    {
        var duplicates = ProductionFieldSeedData.Create()
            .GroupBy(field => field.FriendlyName, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        duplicates.ShouldBeEmpty();
    }

    [Fact]
    public void Create_AssignsSequentialDisplayOrder()
    {
        var fields = ProductionFieldSeedData.Create();

        fields.Select(field => field.DisplayOrder).ShouldBe(Enumerable.Range(0, fields.Count));
    }
}
