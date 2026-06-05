using System.Net;
using System.Net.Http.Json;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.ProductionFields;

[Collection(nameof(IntegrationTestCollection))]
public class ProductionFieldEndpointsTests(RecordKeepingApiFactory factory)
{
    private sealed record CreateRequest(
        string PropertyName,
        string FriendlyName,
        string DataType,
        string? Description,
        string? Category,
        bool IsSummary,
        int DisplayOrder);

    private sealed record UpdateRequest(
        string FriendlyName,
        string DataType,
        string? Description,
        string? Category,
        bool IsSummary,
        int DisplayOrder);

    private sealed record ProductionFieldResponse(
        Guid Id,
        string PropertyName,
        string FriendlyName,
        string? Description,
        string DataType,
        string? Category,
        bool IsSummary,
        int DisplayOrder,
        bool IsActive);

    private static CreateRequest NewField(string suffix) =>
        new($"Test{suffix}", $"Test Field {suffix}", "Decimal", null, "Tests", false, 0);

    private static async Task<ProductionFieldResponse> CreateAsync(HttpClient client, CreateRequest request)
    {
        var response = await client.PostAsJsonAsync("/production-fields", request);
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<ProductionFieldResponse>())!;
    }

    private static async Task<IReadOnlyList<ProductionFieldResponse>> ListAsync(
        HttpClient client, bool includeRetired = false)
    {
        var url = includeRetired ? "/production-fields?includeRetired=true" : "/production-fields";
        return (await client.GetFromJsonAsync<List<ProductionFieldResponse>>(url))!;
    }

    [Fact]
    public async Task Get_ReturnsSeededCatalog()
    {
        var client = factory.CreateClient();

        var fields = await ListAsync(client);

        // The startup seeder populates the legacy field set; spot-check a couple of known keys.
        fields.ShouldContain(f => f.PropertyName == "HotMix" && f.FriendlyName == "Hot Mix");
        fields.ShouldContain(f => f.PropertyName == "GeneratorRan");
    }

    [Fact]
    public async Task Get_SerializesDataTypeAsString()
    {
        var client = factory.CreateClient();

        var fields = await ListAsync(client);

        // I-D21 key "HotMix" is a Decimal field; the enum must serialize as its name, not an integer.
        fields.First(f => f.PropertyName == "HotMix").DataType.ShouldBe("Decimal");
    }

    [Fact]
    public async Task Post_WithValidValues_CreatesField()
    {
        var client = factory.CreateClient();
        var suffix = Guid.NewGuid().ToString("N");

        var created = await CreateAsync(client, NewField(suffix));

        created.Id.ShouldNotBe(Guid.Empty);
        created.PropertyName.ShouldBe($"Test{suffix}");
        created.IsActive.ShouldBeTrue();

        var listed = await ListAsync(client);
        listed.ShouldContain(f => f.Id == created.Id);
    }

    [Fact]
    [Trait("Invariant", "I-D21")]
    public async Task Post_WithDuplicatePropertyName_Returns409()
    {
        var client = factory.CreateClient();

        // "HotMix" is seeded; a second field with that key violates I-D21.
        var response = await client.PostAsJsonAsync(
            "/production-fields",
            new CreateRequest("HotMix", $"Hot Mix {Guid.NewGuid():N}", "Decimal", null, null, false, 0));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Post_WithEmptyPropertyName_Returns400()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/production-fields",
            new CreateRequest("  ", $"Field {Guid.NewGuid():N}", "Decimal", null, null, false, 0));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_UpdatesEditableAttributes()
    {
        var client = factory.CreateClient();
        var suffix = Guid.NewGuid().ToString("N");
        var created = await CreateAsync(client, NewField(suffix));
        var newFriendly = $"Renamed {suffix}";

        var response = await client.PutAsJsonAsync(
            $"/production-fields/{created.Id}",
            new UpdateRequest(newFriendly, "Integer", "Updated", "Mixes", true, 7));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<ProductionFieldResponse>();
        updated!.FriendlyName.ShouldBe(newFriendly);
        updated.DataType.ShouldBe("Integer");
        updated.IsSummary.ShouldBeTrue();
        updated.DisplayOrder.ShouldBe(7);
        // I-D21: PropertyName is immutable across an update.
        updated.PropertyName.ShouldBe($"Test{suffix}");
    }

    [Fact]
    public async Task Put_WhenMissing_Returns404()
    {
        var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/production-fields/{Guid.NewGuid()}",
            new UpdateRequest("Whatever", "Decimal", null, null, false, 0));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Retire_RemovesFieldFromActiveListButKeepsItUnderIncludeRetired()
    {
        var client = factory.CreateClient();
        var suffix = Guid.NewGuid().ToString("N");
        var created = await CreateAsync(client, NewField(suffix));

        var retire = await client.PostAsync($"/production-fields/{created.Id}/retire", null);
        retire.StatusCode.ShouldBe(HttpStatusCode.OK);
        var retired = await retire.Content.ReadFromJsonAsync<ProductionFieldResponse>();
        retired!.IsActive.ShouldBeFalse();

        (await ListAsync(client)).ShouldNotContain(f => f.Id == created.Id);
        (await ListAsync(client, includeRetired: true)).ShouldContain(f => f.Id == created.Id);
    }

    [Fact]
    public async Task Reactivate_RestoresFieldToActiveList()
    {
        var client = factory.CreateClient();
        var suffix = Guid.NewGuid().ToString("N");
        var created = await CreateAsync(client, NewField(suffix));
        await client.PostAsync($"/production-fields/{created.Id}/retire", null);

        var reactivate = await client.PostAsync($"/production-fields/{created.Id}/reactivate", null);

        reactivate.StatusCode.ShouldBe(HttpStatusCode.OK);
        var reactivated = await reactivate.Content.ReadFromJsonAsync<ProductionFieldResponse>();
        reactivated!.IsActive.ShouldBeTrue();
        (await ListAsync(client)).ShouldContain(f => f.Id == created.Id);
    }
}
