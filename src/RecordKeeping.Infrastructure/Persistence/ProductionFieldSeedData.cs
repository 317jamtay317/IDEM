using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// The initial Production Field catalog, transcribed from the legacy plant-pollution record
/// (<c>PlantPollution</c>). Only the measurable fields and flags are carried over — identity and
/// selector columns (Plant, Date, ReasonDidntOpen, DustHandleType, ColdMixType, State) are not
/// Production Fields.
/// </summary>
/// <remarks>
/// PropertyName keys correct the legacy typos (e.g. <c>GenratorRan</c> → <c>GeneratorRan</c>,
/// <c>MonthlySulferContect</c> → <c>MonthlySulfurContent</c>) since the key is immutable (I-D21).
/// Friendly names, categories, and summary flags are a best-effort starting point and are fully
/// editable by a SiteAdmin afterwards.
/// </remarks>
public static class ProductionFieldSeedData
{
    /// <summary>
    /// Builds the seed catalog. Each field's <see cref="ProductionField.DisplayOrder"/> is its
    /// position in this list.
    /// </summary>
    /// <returns>The seed Production Fields, ready to persist.</returns>
    public static IReadOnlyList<ProductionField> Create()
    {
        const ProductionFieldDataType dec = ProductionFieldDataType.Decimal;
        const ProductionFieldDataType num = ProductionFieldDataType.Integer;
        const ProductionFieldDataType yesno = ProductionFieldDataType.Boolean;
        const ProductionFieldDataType date = ProductionFieldDataType.Date;

        var specs = new (string Key, string Friendly, ProductionFieldDataType Type, string Category, bool Summary)[]
        {
            // Mixes
            ("HotMix", "Hot Mix", dec, "Mixes", true),
            ("ColdMix", "Cold Mix", dec, "Mixes", true),
            ("ColdMixTemperature", "Cold Mix Temp", num, "Mixes", true),

            // Aggregates
            ("SteelSlag", "Steel Slag", dec, "Aggregates", true),
            ("BlastFurnace", "Blast Furnace", dec, "Aggregates", true),
            ("CrusherTons", "Crusher Tons", dec, "Aggregates", true),
            ("SandAndGravelTons", "Sand and Gravel Tons", dec, "Aggregates", true),

            // Operations
            ("IsOperated", "Operated", yesno, "Operations", false),
            ("PlantRan", "Plant Ran For", dec, "Operations", true),
            ("SandAndGravelHours", "Sand and Gravel Hours", dec, "Operations", true),

            // Generators
            ("GeneratorRan", "Generator Ran", yesno, "Generators", true),
            ("Generator1", "Generator 1", dec, "Generators", true),
            ("Generator2", "Generator 2", dec, "Generators", true),
            ("Generator1Diesel", "Generator 1 Diesel", dec, "Generators", true),
            ("Generator2Diesel", "Generator 2 Diesel", dec, "Generators", true),

            // Fuels & Burners
            ("BurnerWasteOil", "Waste Oil", dec, "Fuels & Burners", true),
            ("BurnerNumber4", "#4 Fuel Oil", dec, "Fuels & Burners", true),
            ("BurnerNumber2", "Dryer #2 Fuel Oil", dec, "Fuels & Burners", false),
            ("BurnerNaturalGas", "Dryer Natural Gas", dec, "Fuels & Burners", true),
            ("BurnerButaneGas", "Butane", dec, "Fuels & Burners", true),
            ("BurnerPropaneGas", "Propane", dec, "Fuels & Burners", true),
            ("BurnerLandfillGas", "Landfill Gas", dec, "Fuels & Burners", true),
            ("CrusherDieselFuel", "Crusher Diesel", dec, "Fuels & Burners", true),

            // Delivered Fuels
            ("DeliveredWasteOil", "Delivered Waste Oil", dec, "Delivered Fuels", true),
            ("DeliveredNumber4", "Delivered #4", dec, "Delivered Fuels", true),
            ("DeliveredNumber2", "Delivered #2", dec, "Delivered Fuels", true),

            // Fuel Quality
            ("BurnerAvgBtuGalWasteOil", "Avg BTU/gal Waste Oil", dec, "Fuel Quality", true),
            ("BurnerAvgBtuGalNumber4", "Avg BTU/gal #4", dec, "Fuel Quality", true),
            ("BurnerAvgBtuGalNumber2", "Avg BTU/gal #2", dec, "Fuel Quality", true),
            ("PercentSulfurWasteOil", "% Sulfur Waste Oil", dec, "Fuel Quality", true),
            ("PercentSulfurNumber4", "% Sulfur #4", dec, "Fuel Quality", true),
            ("PercentSulfurNumber2", "% Sulfur #2", dec, "Fuel Quality", true),
            ("MonthlySulfurContent", "Monthly Sulfur Content", dec, "Fuel Quality", true),
            ("WasteOilHalogensByWeight", "Waste Oil Halogens (by weight)", dec, "Fuel Quality", false),
            ("WasteOilHalogensPpm", "Waste Oil Halogens (PPM)", dec, "Fuel Quality", false),

            // Oil Heaters
            ("OilHeaterNumber2Fuel", "Oil Heater #2 Fuel", dec, "Oil Heaters", true),
            ("OilHeaterNaturalGas", "Oil Heater Natural Gas", dec, "Oil Heaters", true),
            ("OilHeaterPropaneGas", "Oil Heater Propane", dec, "Oil Heaters", true),
            ("DeliveredHotOilHeaterNumber2", "Delivered Oil Heater #2", dec, "Oil Heaters", true),
            ("HotOilHeaterAvgBtuNumber2", "Oil Heater #2 Avg BTU", dec, "Oil Heaters", true),
            ("HotOilHeaterFuelAvgSulfurNumber2", "Oil Heater #2 Avg Sulfur", dec, "Oil Heaters", false),

            // Liquid AC
            ("PercentBinder", "% Binder", dec, "Liquid AC", true),
            ("PercentDiluent", "% Diluent", dec, "Liquid AC", true),
            ("PercentVocs", "% VOCs", dec, "Liquid AC", true),
            ("RapidCureLiquid", "Rapid Cure", dec, "Liquid AC", true),
            ("MediumCureLiquid", "Medium Cure", dec, "Liquid AC", true),
            ("SlowCureLiquid", "Slow Cure", dec, "Liquid AC", true),
            ("EmulsifiedAsphalt", "Emulsified Asphalt", dec, "Liquid AC", true),
            ("OtherLiquid", "Other Liquid", dec, "Liquid AC", true),

            // RAP
            ("TotalTonsOfVirginMix", "Virgin Mix", dec, "RAP", true),
            ("TotalTonsOfRapMixProduced", "Tons of RAP Mix", dec, "RAP", true),
            ("TotalTonsOfRapUsedInMix", "Tons of RAP Used in Mix", dec, "RAP", true),
            ("AverageFlowRateOfRapMixProduced", "Flow Rate RAP Mix", dec, "RAP", true),

            // Baghouse
            ("FirstShiftInletTemp", "1st Shift Inlet Temp", num, "Baghouse", false),
            ("FirstShiftInletTempTime", "1st Shift Inlet Temp Time", date, "Baghouse", false),
            ("FirstShiftPressureDrop", "1st Shift Pressure Drop", dec, "Baghouse", false),
            ("FirstShiftCycleTime", "1st Shift Cycle Time", date, "Baghouse", false),
            ("SecondShiftInletTemp", "2nd Shift Inlet Temp", num, "Baghouse", false),
            ("SecondShiftInletTempTime", "2nd Shift Inlet Temp Time", date, "Baghouse", false),
            ("SecondShiftPressureDrop", "2nd Shift Pressure Drop", dec, "Baghouse", false),
            ("SecondShiftCycleTime", "2nd Shift Cycle Time", date, "Baghouse", false),

            // Readings
            ("IsCoReadingsTaken", "CO Readings Taken", yesno, "Readings", true),
        };

        var fields = new List<ProductionField>(specs.Length);
        for (var order = 0; order < specs.Length; order++)
        {
            var (key, friendly, type, category, summary) = specs[order];
            var result = ProductionField.Create(
                key, friendly, type, category: category, isSummary: summary, displayOrder: order);
            if (result.IsError)
            {
                throw new InvalidOperationException(
                    $"Invalid seed Production Field '{key}': " +
                    string.Join("; ", result.Errors.Select(error => error.Description)));
            }

            fields.Add(result.Value);
        }

        return fields;
    }
}
