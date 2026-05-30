using System.Reflection;

namespace RecordKeeping.Api.Endpoints;

public static class EndpointExtensions
{
    
    extension(IEndpointRouteBuilder endpointRouteBuilder)
    {
        public void MapEndpoints(params Assembly[] assemblies)
        {
            var endpointTypes = GetEndpoints(assemblies);
            foreach (var endpointType in endpointTypes)
            {
                var endpoint = Activator.CreateInstance(endpointType) as IEndpoint;
                endpoint?.AddEndpoints(endpointRouteBuilder);
            }
        }
    }

    public static Type[] GetEndpoints(Assembly[] assemblies)
    {
        List<Type> endpointTypes = [];
        foreach (var assembly in assemblies)
        {
            endpointTypes.AddRange(assembly.GetTypes().Where(type =>
                typeof(IEndpoint).IsAssignableFrom(type)
                && type is { IsInterface: false, IsAbstract: false }));
        }
        return endpointTypes.ToArray();
    }

}