using System.Linq;
using ModelContextProtocol.Protocol;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Mcp;

/// <summary>
/// The acceptance test for this slice: an AI agent self-registers, logs in, and successfully
/// calls the <c>hello_world</c> MCP tool — proving the full authenticated transport works
/// end-to-end with the real MCP client SDK.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class McpHelloWorldFlowTests(RecordKeepingApiFactory factory)
{
    [Fact]
    public async Task Agent_CanDiscover_TheHelloWorldTool()
    {
        var token = await McpFlow.OnboardAgentAndGetAccessTokenAsync(factory);
        await using var agent = await McpFlow.ConnectAsync(factory, token);

        var tools = await agent.ListToolsAsync();

        tools.Select(t => t.Name).ShouldContain("hello_world");
    }

    [Fact]
    [Trait("Invariant", "I-D16")]
    public async Task Agent_CanCall_HelloWorld_AndIsGreetedByName()
    {
        var token = await McpFlow.OnboardAgentAndGetAccessTokenAsync(factory);
        await using var agent = await McpFlow.ConnectAsync(factory, token);

        var result = await agent.CallToolAsync("hello_world");

        result.IsError.ShouldNotBe(true);
        var text = string.Join("\n", result.Content.OfType<TextContentBlock>().Select(c => c.Text));
        // The bootstrap SiteAdmin's display name proves the agent's token flowed to the tool.
        text.ShouldContain("Site Administrator");
        text.ShouldContain("RecordKeeping");
    }
}
