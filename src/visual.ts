/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

// d3
import * as d3 from "d3";
type Selection<T> = d3.Selection<any, T, any, any>;

import { ScaleLinear as LinearScale, scaleLinear } from "d3-scale";

import HistogramLayout = d3.HistogramGeneratorNumber;

//import LayoutBin = d3.Bin; //layout.histogram.Bin;
interface LayoutBin<Value> extends d3.Bin<any, number>{
    y?: Value
}

// powerbi
import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;
import IViewport = powerbi.IViewport;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;

// powerbi.extensibility
import IVisual = powerbi.extensibility.IVisual;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import IVisualEventService = powerbi.extensibility.IVisualEventService;

// powerbi.extensibility.visual
import ISelectionId = powerbi.visuals.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;

// powerbi-visuals-utils-typeutils
import { pixelConverter as PixelConverter } from "powerbi-visuals-utils-typeutils";

// powerbi-visuals-utils-svgutils
import { shapesInterfaces, CssConstants, manipulation } from "powerbi-visuals-utils-svgutils";
import ISize = shapesInterfaces.ISize;
import translate = manipulation.translate;
import translateAndRotate = manipulation.translateAndRotate;
import ClassAndSelector = CssConstants.ClassAndSelector;
import createClassAndSelector = CssConstants.createClassAndSelector;

// powerbi-visuals-utils-formattingutils
import { valueFormatter as vf, textMeasurementService as tms } from "powerbi-visuals-utils-formattingutils";
import IValueFormatter = vf.IValueFormatter;
import ValueFormatter  = vf.valueFormatter;
import TextProperties = tms.TextProperties;
import textMeasurementService = tms.textMeasurementService;

// powerbi-visuals-utils-colorutils
import { ColorHelper } from "powerbi-visuals-utils-colorutils";

// powerbi-visuals-utils-chartutils
import { axis, dataLabelUtils, dataLabelInterfaces, axisInterfaces, axisScale } from "powerbi-visuals-utils-chartutils";
import ILabelLayout = dataLabelInterfaces.ILabelLayout;
import IAxisProperties = axisInterfaces.IAxisProperties;
import willLabelsFit = axis.LabelLayoutStrategy.willLabelsFit;
import willLabelsWordBreak = axis.LabelLayoutStrategy.willLabelsWordBreak;

// powerbi-visuals-utils-interactivityutils
import { interactivityService } from "powerbi-visuals-utils-interactivityutils";
import appendClearCatcher = interactivityService.appendClearCatcher;
import IInteractiveBehavior = interactivityService.IInteractiveBehavior;
import IInteractivityService = interactivityService.IInteractivityService;
import createInteractivityService = interactivityService.createInteractivityService;
import SelectableDataPoint = interactivityService.SelectableDataPoint;

// powerbi-visuals-utils-tooltiputils
import { TooltipEventArgs, ITooltipServiceWrapper, createTooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";

// histogram
import {
    HistogramGeneralSettings,
    HistogramAxisStyle,
    HistogramAxisSettings,
    HistogramXAxisSettings,
    HistogramYAxisSettings,
    HistogramPositionType,
    HistogramLabelSettings,
    HistogramSettings
} from "./settings";

import { HistogramData, HistogramDataPoint, HistogramSubDataPoint, HistogramBorderValues } from "./dataInterfaces";
import { HistogramBehavior, HistogramBehaviorOptions } from "./behavior";
import { updateOpacity } from "./utils";
import * as HistogramAxisHelper from "./axisHelper";
import * as Default from "./constants";

import "../style/visual.less";

interface HistogramValue {
    value: number;
    selectionId: ISelectionId;
    frequency: number;
}

interface Legend {
    text: string;
    transform?: string;
    dx?: string;
    dy?: string;
    color: string;
}

export class Histogram implements IVisual {
    private static ClassName: string = "histogram";

    private static Axes: ClassAndSelector = createClassAndSelector("axes");
    private static Axis: ClassAndSelector = createClassAndSelector("axis");
    private static XAxis: ClassAndSelector = createClassAndSelector("xAxis");
    private static YAxis: ClassAndSelector = createClassAndSelector("yAxis");

    private static Columns: ClassAndSelector = createClassAndSelector("columns");
    private static Column: ClassAndSelector = createClassAndSelector("column");

    private static Legends: ClassAndSelector = createClassAndSelector("legends");
    private static Legend: ClassAndSelector = createClassAndSelector("legend");

    private static LabelGraphicsContext: ClassAndSelector = createClassAndSelector("labelGraphicsContext");

    private events: IVisualEventService;

    private columnWidth: number = 0;
    private yTitleMargin: number = 0;
    private outerPadding: number = 0;
    private xAxisProperties: IAxisProperties;
    private yAxisProperties: IAxisProperties;

    private viewport: IViewport;
    private viewportIn: IViewport;

    private visualHost: IVisualHost;
    private localizationManager: ILocalizationManager;
    private interactivityService: IInteractivityService;
    private behavior: IInteractiveBehavior;

    private root: Selection<any>;
    private clearCatcher: Selection<any>;
    private main: Selection<any>;
    private axes: Selection<any>;
    private axisX: Selection<any>;
    private axisY: Selection<any>;
    private legend: Selection<any>;
    private columns: Selection<HistogramDataPoint>;
    private labelGraphicsContext: Selection<any>;

    private data: HistogramData;

    private tooltipServiceWrapper: ITooltipServiceWrapper;

    private colorHelper: ColorHelper;

    private get columnsSelection(): Selection<HistogramDataPoint> {
        return this.main
            .select(Histogram.Columns.selectorName)
            .selectAll(Histogram.Column.selectorName);
    }

    constructor(options: VisualConstructorOptions) {
        this.visualHost = options.host;

        this.events = options.host.eventService;

        this.localizationManager = this.visualHost.createLocalizationManager();

        this.interactivityService = createInteractivityService(this.visualHost);
        this.behavior = HistogramBehavior.create();

        this.colorHelper = new ColorHelper(this.visualHost.colorPalette);

        this.tooltipServiceWrapper = createTooltipServiceWrapper(
            options.host.tooltipService,
            options.element
        );

        this.root = d3.select(options.element)
            .append("svg")
            .classed(Histogram.ClassName, true);

        this.clearCatcher = appendClearCatcher(this.root);

        this.main = this.root.append("g");

        this.columns = this.main
            .append("g")
            .classed(Histogram.Columns.className, true);

        this.axes = this.main
            .append("g")
            .classed(Histogram.Axes.className, true);

        this.axisX = this.axes
            .append("g")
            .classed(Histogram.Axis.className, true)
            .classed(Histogram.XAxis.className, true);

        this.axisY = this.axes
            .append("g")
            .classed(Histogram.Axis.className, true)
            .classed(Histogram.YAxis.className, true);

        this.legend = this.main
            .append("g")
            .classed(Histogram.Legends.className, true);

        this.labelGraphicsContext = this.main
            .append("g")
            .classed(Histogram.LabelGraphicsContext.className, true);
    }

    public static converter(
        dataView: DataView,
        visualHost: IVisualHost,
        localizationManager: ILocalizationManager,
        colorHelper: ColorHelper,
    ): HistogramData {

        if (!dataView
            || !dataView.categorical
            || !dataView.categorical.categories
            || !dataView.categorical.categories[0]
            || !dataView.categorical.categories[0].values
            || !(dataView.categorical.categories[0].values.length > 0)
        ) {
            return null;
        }

        let settings: HistogramSettings,
            categoryColumn: DataViewCategoryColumn = dataView.categorical.categories[0],
            histogramLayout: HistogramLayout<any, number>, //test
            values: HistogramValue[],
            numericalValues: number[] = [],
            bins: LayoutBin<number>[],
            dataPoints: HistogramDataPoint[],
            valueFormatter: IValueFormatter,
            frequencies: number[] = [],
            sumFrequency: number = Default.SumFrequency,
            xLabelFormatter: IValueFormatter,
            yLabelFormatter: IValueFormatter,
            borderValues: HistogramBorderValues,
            yAxisSettings: HistogramYAxisSettings,
            xAxisSettings: HistogramXAxisSettings,
            sourceValues: number[] = categoryColumn.values as number[];

        settings = Histogram.parseSettings(dataView, colorHelper);

        if (!settings
            || !Histogram.areValuesNumbers(categoryColumn)
            || sourceValues.length < Default.MinAmountOfValues
        ) {
            return null;
        }

        if (dataView.categorical.values &&
            dataView.categorical.values[0] &&
            dataView.categorical.values[0].values
        ) {
            frequencies = dataView.categorical.values[0].values as number[];
        }

        values = Histogram.getValuesByFrequencies(
            visualHost,
            categoryColumn,
            sourceValues,
            frequencies
        );

        values.forEach((value: HistogramValue) => {
            numericalValues.push(value.value);
            sumFrequency += value.frequency;
        });

        histogramLayout = d3.histogram();
        
        if (settings.general.bins && settings.general.bins > HistogramGeneralSettings.MinNumberOfBins) {
            histogramLayout = histogramLayout.thresholds(settings.general.bins);
        }
        
        //bins = histogramLayout.frequency(settings.general.frequency)(numericalValues);//TODO TEST
        bins =  d3.histogram()(numericalValues); 

        bins.forEach((bin: LayoutBin<number>, index: number) => {
            let filteredValues: HistogramValue[],
                frequency: number;

            filteredValues = values.filter((value: HistogramValue) => {
                return Histogram.isValueContainedInRange(value, bin, index);
            });

            frequency = filteredValues.reduce((previousValue: number, currentValue: HistogramValue): number => {
                return previousValue + currentValue.frequency;
            }, 0);

            bin.y = settings.general.frequency
                ? frequency
                : frequency / sumFrequency;
            });
        
        //TMP console.warn('DBG Converter frequency', settings.general.frequency, frequencies, sumFrequency)
        //TMP console.warn('DBG Converter: bins', values, '>', numericalValues, '>', bins);
        borderValues = Histogram.getBorderValues(bins);

        // min-max for Y axis
        yAxisSettings = settings.yAxis;

        let maxYvalue: number = (yAxisSettings.end !== null) && (yAxisSettings.end > yAxisSettings.start)
            ? yAxisSettings.end
            : borderValues.maxY;

        let minYValue: number = yAxisSettings.start < maxYvalue
            ? yAxisSettings.start
            : 0;

        settings.yAxis.start = Histogram.getCorrectYAxisValue(minYValue);
        settings.yAxis.end = Histogram.getCorrectYAxisValue(maxYvalue);

        // min-max for X axis
        xAxisSettings = settings.xAxis;

        let maxXvalue: number = (xAxisSettings.end !== null) && (xAxisSettings.end > borderValues.minX)
            ? xAxisSettings.end
            : borderValues.maxX;

        let minXValue: number = (xAxisSettings.start !== null) && xAxisSettings.start < maxXvalue
            ? xAxisSettings.start
            : borderValues.minX;
        
        //REVIEW mutability!
        settings.xAxis.start = Histogram.getCorrectXAxisValue(minXValue);
        settings.xAxis.end = Histogram.getCorrectXAxisValue(maxXvalue);


        if (values.length >= Default.MinAmountOfValues) {
            valueFormatter = ValueFormatter.create({
                format: ValueFormatter.getFormatStringByColumn(dataView.categorical.categories[0].source),
                value: values[0].value,
                value2: values[values.length - 1].value,
                precision: settings.labels.precision
            });

            xLabelFormatter = ValueFormatter.create({
                value: settings.xAxis.displayUnits === 0
                    ? values[values.length - 1].value
                    : settings.xAxis.displayUnits,
                precision: settings.xAxis.precision
            });

            yLabelFormatter = ValueFormatter.create({
                value: settings.yAxis.displayUnits,
                precision: settings.yAxis.precision
            });
        }

        dataPoints = Histogram.getDataPoints(
            values,
            bins,
            settings,
            yLabelFormatter,
            xLabelFormatter,
            localizationManager
        );

        return {
            dataPoints,
            borderValues,
            settings,
            xLabelFormatter,
            yLabelFormatter,
            formatter: valueFormatter,
            xLegendSize: Histogram.getLegendSize(settings.xAxis),
            yLegendSize: Histogram.getLegendSize(settings.yAxis),
            xCorrectedMin: null,
            xCorrectedMax: null
        };
    }

    //REVIEW used TWICE by converter
    private static getLegendSize = (axisSettings: HistogramAxisSettings): number =>
        axisSettings.title
        ? Default.LegendSizeWhenTitleIsActive
        : Default.LegendSizeWhenTitleIsNotActive;

    //REVIEW UNIQUE TESTED helper used by CONVERTER
    public static getBorderValues(bins: LayoutBin<number>[]): HistogramBorderValues {
        const borderValues: HistogramBorderValues = {
            minX: Number.MAX_VALUE,
            maxX: -Number.MAX_VALUE,
            minY: Number.MAX_VALUE,
            maxY: -Number.MAX_VALUE
        };

        bins.forEach((dataPoint: LayoutBin<number>) => {
            let minX: number = Number.MAX_VALUE,
                maxX: number = -Number.MAX_VALUE;

            dataPoint.forEach((x: number) => {
                if (x > maxX) {
                    maxX = x;
                }

                if (x < minX) {
                    minX = x;
                }
            });

            if (minX < borderValues.minX) {
                borderValues.minX = minX;
            }

            if (maxX > borderValues.maxX) {
                borderValues.maxX = maxX;
            }

            if (dataPoint.y < borderValues.minY) {
                borderValues.minY = dataPoint.y;
            }

            if (dataPoint.y > borderValues.maxY) {
                borderValues.maxY = dataPoint.y;
            }
        });

        return borderValues;
    }

    //REVIEW TESTED helper used by CONVERTER
    public static getCorrectXAxisValue(value: number): number {
        if (value === undefined || isNaN(value)) {
            return 0;
        }

        return Math.max(
            Math.min(value, Default.MaxXAxisEndValue),
            Default.MinXAxisStartValue);
    }

    //REVIEW TESTED helper used by CONVERTER
    public static getCorrectYAxisValue(value: number): number {
        if (value === undefined || isNaN(value)) {
            return 0;
        }

        return Math.max(
            Math.min(value, Default.MaxXAxisEndValue),
            0);
    }

    //REVIEW UNIQUE TESTED helper-getter used by CONVERTER
    public static areValuesNumbers(categoryColumn: DataViewCategoryColumn): boolean {
        return categoryColumn
            && categoryColumn.source
            && (categoryColumn.source.type.numeric || categoryColumn.source.type.integer);
    }

    //REVIEW UNIQUE helper used by CONVERTER
    private static getValuesByFrequencies(
        visualHost: IVisualHost,
        categoryColumn: DataViewCategoryColumn,
        sourceValues: number[],
        frequencies: number[]
    ): HistogramValue[] {

        const values: HistogramValue[] = [],
            queryName: string = Histogram.getCategoryColumnQuery(categoryColumn);

        sourceValues.forEach((item: number, index: number) => {
            let frequency: number = Default.Frequency,
                value: number = Number(item),
                selectionId: ISelectionId;

            value = isNaN(value)
                ? Default.Value
                : value;

            selectionId = visualHost.createSelectionIdBuilder()
                .withCategory(categoryColumn, index)
                .withMeasure(queryName)
                .createSelectionId();

            if (frequencies
                && frequencies[index]
                && !isNaN(frequencies[index])
                && frequencies[index] > Default.MinFrequencyNumber
            ) {
                frequency = frequencies[index];
            }

            values.push({
                value,
                frequency,
                selectionId
            });
        });

        return values;
    }

    //REVIEW UNIQUE getter used by getValuesByFrequencies / CONVERTER
    private static getCategoryColumnQuery(categoryColumn: DataViewCategoryColumn): string {
        return categoryColumn && categoryColumn.source
            ? categoryColumn.source.queryName
            : undefined;
    }

    //REVIEW UNIQUE helper used by getValuesByFrequencies / CONVERTER
    private static getDataPoints(
        values: HistogramValue[],
        bins: LayoutBin<number>[],
        settings: HistogramSettings,
        yValueFormatter: IValueFormatter,
        xValueFormatter: IValueFormatter,
        localizationManager: ILocalizationManager
    ): HistogramDataPoint[] {

        let fontSizeInPx: string = PixelConverter.fromPoint(settings.labels.fontSize);

        return bins.map((bin: any, index: number): HistogramDataPoint => {
            bin.range = [bin.x0, bin.x1];

            bin.tooltipInfo = Histogram.getTooltipData(
                bin.y,
                bin.range,
                settings,
                index === 0,
                yValueFormatter,
                xValueFormatter,
                localizationManager);

            bin.subDataPoints = Histogram.getSubDataPoints(values, bin, index);

            bin.labelFontSize = fontSizeInPx;

            return bin;
        });
    }
    
    //REVIEW UNIQUE helper used by getDataPoints / getValuesByFrequencies / CONVERTER
    private static getTooltipData(
        value: number,
        range: number[],
        settings: HistogramSettings,
        includeLeftBorder: boolean,
        yValueFormatter: IValueFormatter,
        xValueFormatter: IValueFormatter,
        localizationManager: ILocalizationManager
    ): VisualTooltipDataItem[] {
        return [
            {
                displayName: Histogram.getLegendText(settings, localizationManager),
                value: yValueFormatter.format(value)
            }, {
                displayName: localizationManager.getDisplayName("Visual_TooltipDisplayName"),
                value: Histogram.rangeToString(range, includeLeftBorder, xValueFormatter)
            }
        ];
    }

    //REVIEW UNIQUE helper used by getTooltipData / getValuesByFrequencies / CONVERTER
    private static rangeToString(
        range: number[],
        includeLeftBorder: boolean,
        valueFormatter: IValueFormatter
    ): string {
        const rightBracket: string = Default.IncludeBrackets.right;
        const leftBorder: string = valueFormatter.format(range[0]);
        const rightBorder: string = valueFormatter.format(range[1]);

        const leftBracket = includeLeftBorder
            ? Default.IncludeBrackets.left
            : Default.ExcludeBrackets.left;

        return `${leftBracket}${leftBorder}${Default.SeparatorNumbers}${rightBorder}${rightBracket}`;
    }

    //REVIEW UNIQUE helper used by getDataPoints / getValuesByFrequencies / CONVERTER
    private static getSubDataPoints(
        values: HistogramValue[],
        bin: HistogramDataPoint,
        index: number
    ): HistogramSubDataPoint[] {
        const dataPoints: SelectableDataPoint[] = [];

        values.forEach((value: HistogramValue) => {
            if (Histogram.isValueContainedInRange(value, bin, index)) {
                dataPoints.push({
                    identity: value.selectionId,
                    selected: false
                });
            }
        });

        return dataPoints;
    }

    //REVIEW immutable helper used TWICE by CONVERTER and getSubDataPoints / getDataPoints / getValuesByFrequencies / CONVERTER
    private static isValueContainedInRange(
        value: HistogramValue, 
        bin: LayoutBin<number>, 
        index: number
    ): boolean {
        return ((index === 0 && value.value >= bin.x1) || (value.value > bin.x1))
            && value.value <= bin.x1 + (bin.x1-bin.x0);
    }

    //REVIEW UNIQUE helper used by CONVERTER
    private static parseSettings(
        dataView: DataView,
        colorHelper: ColorHelper,
    ): HistogramSettings {
        const settings: HistogramSettings = HistogramSettings.parse<HistogramSettings>(dataView);
        const displayName: string = Histogram.getDisplayName(dataView);

        let bins: number = Math.round(settings.general.bins);

        if (displayName) {
            settings.general.displayName = displayName;
        }

        if (isNaN(bins) || bins <= HistogramGeneralSettings.MinNumberOfBins) {
            bins = HistogramGeneralSettings.DefaultBins;
        } else if (bins > HistogramGeneralSettings.MaxNumberOfBins) {
            bins = HistogramGeneralSettings.MaxNumberOfBins;
        }

        settings.general.bins = bins;

        settings.dataPoint.fill = colorHelper.getHighContrastColor("foreground", settings.dataPoint.fill);

        settings.xAxis.precision = Histogram.getPrecision(settings.xAxis.precision);
        settings.xAxis.axisColor = colorHelper.getHighContrastColor("foreground", settings.xAxis.axisColor);
        settings.xAxis.strokeColor = colorHelper.getHighContrastColor("foreground", settings.xAxis.strokeColor);

        settings.yAxis.precision = Histogram.getPrecision(settings.yAxis.precision);
        settings.yAxis.axisColor = colorHelper.getHighContrastColor("foreground", settings.yAxis.axisColor);
        settings.yAxis.strokeColor = colorHelper.getHighContrastColor("foreground", settings.yAxis.strokeColor);

        settings.labels.precision = Histogram.getPrecision(settings.labels.precision);
        settings.labels.color = colorHelper.getHighContrastColor("foreground", settings.labels.color);

        settings.general.displayName = Histogram.getLegend(
            settings.general.displayName,
            settings.xAxis.style,
            settings.xAxis.displayUnits
        );

        return settings;
    }

    //REVIEW UNIQUE immutable helper-getter used by parseSettings / CONVERTER
    private static getDisplayName(dataView: DataView): string {
        return (dataView
            && dataView.metadata
            && dataView.metadata.columns
            && dataView.metadata.columns[0]
            && dataView.metadata.columns[0].displayName
        ) || null;
    }

    private static getPrecision(precision: number): number {
        return Math.min(
            Math.max(precision, Default.MinPrecision),
            Default.MaxPrecision
        );
    }

/*
    ===============================================================================================
    ============================ TOP LEVEL ========================================================
    ===============================================================================================
*/

    public static getLegend(title: string, style: HistogramAxisStyle, displayUnit: number): string {
        const formatter: IValueFormatter = ValueFormatter.create({ value: displayUnit, });

        switch (style) {
            case HistogramAxisStyle.showTitleOnly: {
                return title;
            }
            case HistogramAxisStyle.showUnitOnly: {
                return !(displayUnit === 0 || displayUnit === 1) && formatter.displayUnit
                    ? formatter.displayUnit.title
                    : title;
            }
            case HistogramAxisStyle.showBoth: {
                return !(displayUnit === 0 || displayUnit === 1) && formatter.displayUnit
                    ? `${title} (${formatter.displayUnit.title})`
                    : title;
            }
        }

        return undefined;
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        const settings: HistogramSettings = this.data && this.data.settings
            ? this.data.settings
            : HistogramSettings.getDefault() as HistogramSettings;

        return HistogramSettings.enumerateObjectInstances(settings, options);
    }

    public isDataValid(data: HistogramData): boolean {
        if (!data
            || !data.dataPoints
            || data.dataPoints.length === Default.MinAmountOfDataPoints) {
            console.warn('return false!', data.dataPoints);
            return false;
        }

        return !data.dataPoints.some((dataPoint: HistogramDataPoint) => {
            return dataPoint.range.some((rangeValue: number) => {
                return isNaN(rangeValue)
                    || rangeValue === Infinity
                    || rangeValue === -Infinity;
            });
        });
    }

    public update(options: VisualUpdateOptions): void {
        
        if (!options
            || !options.dataViews
            || !options.dataViews[0]) {
                return;
            }
            try {
                this.events.renderingStarted(options);

                const dataView: DataView = options.dataViews[0];

                this.data = Histogram.converter(
                    dataView,
                    this.visualHost,
                    this.localizationManager,
                    this.colorHelper,
                );

                if (!this.isDataValid(this.data)) {
                    this.clear();
                    return;
                }

                this.updateViewport(options.viewport);

                this.yTitleMargin = this.shouldShowYOnRight()
                    ? this.viewport.width - Default.YTitleMargin + this.data.yLegendSize
                    : Default.MinYTitleMargin;

                this.updateElements(
                    Math.max(this.viewport.height, Default.MinViewportSize),
                    Math.max(this.viewport.width, Default.MinViewportSize));

                const maxWidthOfVerticalAxisLabel = Histogram.getWidthOfLabel(
                    this.data.borderValues.maxY,
                    this.data.yLabelFormatter),
                maxWidthOfHorizontalAxisLabel = Histogram.getWidthOfLabel(
                    this.data.borderValues.maxX,
                    this.data.xLabelFormatter),
                maxHeightOfVerticalAxisLabel = Histogram.getHeightOfLabel(
                    this.data.borderValues.maxX,
                    this.data.xLabelFormatter),

                ySource = dataView.categorical.values &&
                    dataView.categorical.values[0] &&
                    dataView.categorical.values[0].values
                    ? dataView.categorical.values[0].source
                    : dataView.categorical.categories[0].source,
                xSource = dataView.categorical.categories[0].source;

                this.updateViewportIn();

                this.createScales();

                this.yAxisProperties = this.calculateYAxes(ySource, maxHeightOfVerticalAxisLabel);
                this.xAxisProperties = this.calculateXAxes(xSource, maxWidthOfHorizontalAxisLabel, false);

                this.renderYAxis(); 

                this.updateViewportIn(maxWidthOfVerticalAxisLabel);

                this.renderXAxis();

                this.columnsAndAxesTransform(maxWidthOfVerticalAxisLabel);

                this.applySelectionStateToData();

                const columnsSelection: Selection<any> = this.renderColumns();
                this.bindTooltipToSelection(columnsSelection);
                this.bindSelectionHandler(columnsSelection);

                this.renderLegend();

                this.renderLabels();

                this.events.renderingFinished(options);
        }
        catch (e) {
            console.error(e);
            this.events.renderingFailed(options);
        }
    }

    public destroy(): void {
        this.root = null;
    }

/*
    ===============================================================================================
    =================================== UPDATE BRANCHES ===========================================
    ===============================================================================================
*/

    //REVIEW UNIQUE branch of UPDATE
    private applySelectionStateToData(): void {
        if (this.interactivityService) {
            this.data.dataPoints.forEach((dataPoint: HistogramDataPoint) => {
                this.interactivityService.applySelectionStateToData(dataPoint.subDataPoints);
            });
        }
    }

    //REVIEW branch of UPDATE
    private updateViewport(viewport: IViewport): void {
        const height = viewport.height - Default.SvgMargin.top - Default.SvgMargin.bottom;
        const width = viewport.width - Default.SvgMargin.left - Default.SvgMargin.right;

        this.viewport = {
            height: Math.max(height, Default.MinViewportSize),
            width: Math.max(width, Default.MinViewportSize)
        };
    }
    
    //REVIEW used in UPDATE
    private updateViewportIn(maxWidthOfVerticalAxisLabel: number = 0): void {
        const width: number = this.viewport.width - this.data.yLegendSize - maxWidthOfVerticalAxisLabel,
            height: number = this.viewport.height - this.data.xLegendSize;

        this.viewportIn = {
            height: Math.max(height, Default.MinViewportInSize),
            width: Math.max(width, Default.MinViewportInSize)
        };
    }

    //REVIEW used ONCE by setSize / UPDATE
    private updateElements(height: number, width: number): void {
        const transform: string = translate(
            Default.SvgMargin.left,
            Default.SvgMargin.top);

        this.root
            .attr("height", height)
            .attr("width", width);

        this.main.attr("transform", transform);
        this.legend.attr("transform", transform);
    }

    //REVIEW UNIQUE branch of UPDATE
    private createScales(): void {
        const yAxisSettings: HistogramYAxisSettings = this.data.settings.yAxis,
            xAxisSettings: HistogramXAxisSettings = this.data.settings.xAxis,
            borderValues: HistogramBorderValues = this.data.borderValues;

        this.data.xScale = scaleLinear()
            .domain([
                this.data.xCorrectedMin !== null ? this.data.xCorrectedMin : xAxisSettings.start,
                this.data.xCorrectedMax !== null ? this.data.xCorrectedMax : xAxisSettings.end
            ])
            .range([
                0,
                this.viewportIn.width
            ]);

        this.data.yScale = scaleLinear()
            .domain([
                yAxisSettings.start,
                yAxisSettings.end
            ])
            .range([
                this.viewportIn.height,
                this.outerPadding
            ]);
    }

    //REVIEW branch of UPDATE
    private columnsAndAxesTransform(labelWidth: number): void {
        const offsetToRight: number = this.shouldShowYOnRight()
            ? Default.SvgMargin.left
            : this.data.settings.yAxis.title
                ? Default.SvgMargin.left + labelWidth + Default.YAxisMargin
                : Default.SvgMargin.left + labelWidth;

        const offsetToRightStr = translate(
            offsetToRight + Default.ColumnAndLabelOffset,
            Default.SvgPosition
        );

        this.columns.attr("transform", offsetToRightStr);
        this.labelGraphicsContext.attr("transform", offsetToRightStr);

        this.axes.attr("transform", translate(
            offsetToRight,
            Default.SvgPosition)
        );

        this.axisY.attr("transform", translate(
            this.shouldShowYOnRight()
                ? this.viewportIn.width
                : Default.SvgPosition,
                Default.SvgPosition)
        );

        this.axisX.attr("transform", translate(
            Default.SvgPosition,
            this.viewportIn.height)
        );
    }

// =========================================================================================== UPDATE / Bindings
    //REVIEW UNIQUE branch of UPDATE
    private bindTooltipToSelection(selection: Selection<any>): void {
        this.tooltipServiceWrapper.addTooltip(selection, (eventArgs: TooltipEventArgs<HistogramDataPoint>) => {
            return eventArgs.data.tooltipInfo;
        });
    }

    //REVIEW UNIQUE branch of UPDATE
    private bindSelectionHandler(columnsSelection: Selection<HistogramDataPoint>): void {
        if (!this.interactivityService
            || !this.data
            || !this.data.dataPoints
        ) {
            return;
        }

        let subDataPoints: SelectableDataPoint[] = [];

        this.data.dataPoints.forEach((dataPoint: HistogramDataPoint) => {
            subDataPoints = subDataPoints.concat(dataPoint.subDataPoints);
        });

        const behaviorOptions: HistogramBehaviorOptions = {
            columns: columnsSelection,
            clearCatcher: this.clearCatcher,
            interactivityService: this.interactivityService,
        };

        this.interactivityService.bind(
            subDataPoints,
            this.behavior,
            behaviorOptions
        );
    }

//====================================================================================================== renderColumns
    
    //REVIEW branch of UPDATE
    private renderColumns(): Selection<HistogramDataPoint> {
        const data: HistogramDataPoint[] = this.data.dataPoints;

        const xScale: LinearScale<any, any> = this.data.xScale;
        const yScale: LinearScale<any, any> = this.data.yScale;

        const columnsSelection: Selection<any> = this.columnsSelection.data(data);

        let updateColumnsSelection = columnsSelection
            .enter()
            .append("svg:rect")
            .classed(Histogram.Column.className, true);

            
        const strokeWidth: number = this.getStrokeWidth();
            
        this.columnWidth = this.getColumnWidth(strokeWidth);
            

        columnsSelection
            .merge(updateColumnsSelection)
            .attr("x", (dataPoint: HistogramDataPoint) => { return xScale(dataPoint.x0); })
            .attr("y", (dataPoint: HistogramDataPoint) => { 
                //TMP console.log('DBG Y dataPoint', dataPoint); 
                return yScale(dataPoint["y"]); 
            })
            .attr("width", this.columnWidth)
            .attr("height", (dataPoint: HistogramDataPoint) => { return this.getColumnHeight(dataPoint, yScale); })
            
            .style("fill", this.colorHelper.isHighContrast ? null : this.data.settings.dataPoint.fill)
            .style("stroke", this.colorHelper.isHighContrast ? this.data.settings.dataPoint.fill : null)
            .style("stroke-width", PixelConverter.toString(strokeWidth));
            
        updateOpacity(
            columnsSelection.merge(updateColumnsSelection),
            this.interactivityService,
            false
        );

        columnsSelection
            .exit()
            .remove();

        return columnsSelection.merge(updateColumnsSelection);
    }

    //REVIEW used ONCE by renderColumns / UPDATE
    private getColumnWidth(strokeWidth: number): number {
        const countOfValues: number = this.data.dataPoints.length;
        const borderValues: HistogramBorderValues = this.data.borderValues;

        const firstDataPoint: number = this.data.xCorrectedMin
            ? this.data.xCorrectedMin
            : borderValues.minX;

        const widthOfColumn = countOfValues
            ? this.data.xScale(firstDataPoint + (this.data.dataPoints[0].x1 - this.data.dataPoints[0].x0)) - Default.ColumnPadding - strokeWidth
            : Default.MinViewportInSize;

        return Math.max(widthOfColumn, Default.MinViewportInSize);
    }

//====================================================================================================== renderLabels
    //REVIEW branch of UPDATE 
    private renderLabels(): void {
        let labelSettings: HistogramLabelSettings = this.data.settings.labels,
            dataPointsArray: HistogramDataPoint[] = this.data.dataPoints,
            labels: Selection<HistogramDataPoint>;

        if (!labelSettings.show) {
            dataLabelUtils.cleanDataLabels(this.labelGraphicsContext);

            return;
        }

        labels = dataLabelUtils.drawDefaultLabelsForDataPointChart(
            dataPointsArray,
            this.labelGraphicsContext,
            this.getLabelLayout(),
            this.viewportIn);

        if (labels) {
            labels.attr("transform", (dataPoint: HistogramDataPoint) => {
                let size: ISize = dataPoint.size,
                    dx: number,
                    dy: number;

                dx = size.width / Default.DataLabelXOffset;
                dy = size.height / Default.DataLabelYOffset;

                return translate(dx, dy);
            });
        }
    }

    //REVIEW branch of UPDATE
    private renderLegend(): void {
        const dataLegends: Legend[] = this.getDataLegends(this.data.settings);

        const legendElements: Selection<Legend> = this.main
            .select(Histogram.Legends.selectorName)
            .selectAll(Histogram.Legend.selectorName);

        const legendSelection: Selection<Legend> = legendElements.data(dataLegends);

        legendSelection
            .enter()
            .append("svg:text");

        legendSelection
            .attr("x", Default.SvgLegendPosition)
            .attr("y", Default.SvgLegendPosition)
            .attr("dx", (legend: Legend) => legend.dx)
            .attr("dy", (legend: Legend) => legend.dy)
            .attr("transform", (legend: Legend) => legend.transform)
            
            .style("fill", (legend: Legend) => legend.color)
            .text((item: Legend) => item.text)
            .classed(Histogram.Legend.className, true);

        legendSelection
            .exit()
            .remove();

        const getDisplayForAxisTitle = (axisSettings: HistogramAxisSettings) : string => 
            (axisSettings && axisSettings.title) 
            ? null 
            : "none";

        this.legend
            .select("text")
            .style("display", getDisplayForAxisTitle(this.data.settings.xAxis));

        this.legend
            .selectAll("text")
            .filter((d, index: number) => index === 1)
            .style("display", getDisplayForAxisTitle(this.data.settings.yAxis));
    }

    //REVIEW branch of UPDATE
    private clear(): void {
        [
            this.axisX,
            this.axisY,
            this.legend,
            this.columns,
            this.labelGraphicsContext
        ].forEach((selection: Selection<any>) => {
            this.clearElement(selection);
        });
    }

/*
    ===============================================================================================
    ===================================== SECOND LEVEL ============================================
    ===============================================================================================
*/


    //====================================================================================================== ???

    //REVIEW used at columnsANdAxesTransform and getDataLegends
    public shouldShowYOnRight(): boolean {
        return this.data.settings.yAxis.position === HistogramPositionType.Right;
    }

    private getStrokeWidth(): number {
        return this.colorHelper.isHighContrast ? 2 : 0;
    }

    //REVIEW renderColumns / UPDATE
    private getColumnHeight(column: LayoutBin<number>, y: LinearScale<any, any>): number {
        const height: number = this.viewportIn.height - y(column.y);

        return Math.max(height, Default.MinColumnHeight);
    }

 //========================================================================================================= renderLabel
    //REVIEW branch of renderLabel / UPDATE
    private getLabelLayout(): ILabelLayout {
        let labelSettings: HistogramLabelSettings = this.data.settings.labels,
            xScale: LinearScale<any, any> = this.data.xScale,
            yScale: LinearScale<any, any> = this.data.yScale,
            fontSizeInPx: string = PixelConverter.fromPoint(labelSettings.fontSize),
            fontFamily: string = dataLabelUtils.LabelTextProperties.fontFamily,
            dataLabelFormatter: IValueFormatter = ValueFormatter.create({
                value: labelSettings.displayUnits,
                precision: labelSettings.precision
            });

        return {
            labelText: (dataPoint: HistogramDataPoint) => {
                return dataLabelFormatter.format(dataPoint["y"]).toString();
            },
            labelLayout: {
                x: (dataPoint: HistogramDataPoint) => {
                    let x: number,
                        dx: number;

                    x = xScale(dataPoint.x1);
                    dx = dataPoint.size.width / Default.DataLabelXOffset
                        - this.columnWidth / Default.MiddleFactor;

                    return x - dx;
                },
                y: (dataPoint: HistogramDataPoint) => {
                    let y: number,
                        dy: number,
                        delta: number;

                    y = yScale(dataPoint["y"]);
                    dy = dataPoint.size.height;
                    delta = y - dy;

                    return delta < 0 ? y + dy / 2 : delta;
                }
            },
            filter: (dataPoint: HistogramDataPoint) => {
                return dataPoint != null;
            },
            style: {
                "fill": labelSettings.color,
                "font-size": fontSizeInPx,
                "font-family": fontFamily
            }
        };
    }

//========================================================================================================= UPDATE \ renderLegend
    //REVIEW branch of renderLegend / UPDATE
    private getDataLegends(settings: HistogramSettings): Legend[] {
        let bottomLegendText: string = Histogram.getLegendText(settings, this.localizationManager);

        bottomLegendText = Histogram.getLegend(
            bottomLegendText,
            settings.yAxis.style,
            settings.yAxis.displayUnits
        );
        
        return [
            {
                transform: translate(
                    this.viewport.width / Default.MiddleFactor,
                    this.viewport.height),
                text: Histogram.getTailoredTextOrDefault(
                    settings.general.displayName,
                    this.viewportIn.width),
                dx: Default.SvgXAxisDx,
                dy: Default.SvgXAxisDy,
                color: settings.xAxis.axisColor,
            }, {
                transform: translateAndRotate(
                    this.shouldShowYOnRight()
                        ? this.yTitleMargin
                        : Default.SvgPosition,
                    this.viewport.height / Default.MiddleFactor,
                    Default.SvgPosition,
                    Default.SvgPosition,
                    Default.SvgAngle),
                text: Histogram.getTailoredTextOrDefault(
                    bottomLegendText,
                    this.viewportIn.height),
                dx: Default.SvgYAxisDx,
                color: settings.yAxis.axisColor,
            }
        ];
    }

//========================================================================================================= UPDATE \ updateAxes \ labels
    //REVIEW used TWICE by updateAxes / UPDATE
    private static getWidthOfLabel(
        labelValue: number | string,
        valueFormatter: IValueFormatter
    ): number {
        const textProperties: TextProperties =
            Histogram.getTextPropertiesForMeasurement(labelValue, valueFormatter);

        return textMeasurementService.measureSvgTextWidth(textProperties) + Default.AdditionalWidthOfLabel;
    }

    //REVIEW UNIQUE used by updateAxes / UPDATE
    private static getHeightOfLabel(
        labelValue: number | string,
        valueFormatter: IValueFormatter
    ): number {
        const textProperties: TextProperties =
            Histogram.getTextPropertiesForMeasurement(labelValue, valueFormatter);

        return textMeasurementService.measureSvgTextHeight(textProperties) + Default.AdditionalHeightOfLabel;
    }

    //REVIEW used by getHeightOfLabel & getWidthOfLabel / updateAxes / UPDATE
    private static getTextPropertiesForMeasurement(
        labelValue: string | number,
        valueFormatter?: IValueFormatter
    ): TextProperties {

        let labelText: string;

        if (valueFormatter) {
            labelText = valueFormatter.format(labelValue);
        } else {
            labelText = labelValue as string;
        }

        return { text: labelText, ...Default.TextProperties };
    }

//========================================================================================================= UPDATE \ updateAxes \ Y Axis

    //REVIEW UNIQUE branch of updateAxes / UPDATE
    private calculateYAxes(
        metaDataColumn: DataViewMetadataColumn,
        minOrdinalRectThickness: number
    ): IAxisProperties {
        let yAxisSettings: HistogramYAxisSettings = this.data.settings.yAxis,
            formatString: string = (this.data.settings.general.frequency)
                ? ValueFormatter.getFormatStringByColumn(metaDataColumn)
                : undefined;

        return HistogramAxisHelper.createAxis({
            pixelSpan: this.viewportIn.height,
            dataDomain: [yAxisSettings.start, yAxisSettings.end],
            metaDataColumn,
            formatString: formatString,
            outerPadding: this.outerPadding,
            isScalar: true,
            isVertical: true,
            useTickIntervalForDisplayUnits: true,
            isCategoryAxis: false,
            getValueFn: (index: number) => index,
            scaleType: axisScale.linear,
            innerPaddingRatio: Default.InnerPaddingRatio,
            minOrdinalRectThickness: minOrdinalRectThickness,
            tickLabelPadding: undefined,
            is100Pct: true
        });
    }
    
    //REVIEW Branch of updateAxis / UPDATE
    private renderYAxis(): void {
        const yAxisSettings: HistogramYAxisSettings = this.data.settings.yAxis;

        if (!yAxisSettings.show) {
            this.clearElement(this.axisY);
            return;
        }

        const yAxis = d3.axisLeft(this.data.yScale) 
            .tickFormat((item: number) => {
                return this.data.yLabelFormatter.format(item);
            });

        this.axisY.call(yAxis);
        this.axisY
            .style("fill", yAxisSettings.axisColor)
            .style("stroke", yAxisSettings.strokeColor);
    }

//========================================================================================================= UPDATE \ updateAxes \ X Axis

    //REVIEW Branch of updateAxis / UPDATE
    private renderXAxis(): void {
        const xAxisSettings: HistogramXAxisSettings = this.data.settings.xAxis;

        if (!xAxisSettings.show) {
            this.clearElement(this.axisX);
            return;
        }

        const xAxis = d3.axisBottom(this.data.xScale)
            .tickFormat(((value: number, index: number) => {
                const tickValues: any[] = this.xAxisProperties.axis.tickValues();
                const amountOfLabels: number = (tickValues && tickValues.length) || Default.MinLabelNumber;

                return this.formatLabelOfXAxis(value, index, amountOfLabels);
            }) as any) // We cast this function to any, because the type definition doesn't contain the second argument

        this.axisX.call(xAxis);
        
        this.axisX
            .style("fill", xAxisSettings.axisColor)
            .style("stroke", xAxisSettings.strokeColor)
    }
    
    //REVIEW branch of renderXAxis / updateAxis / UPDATE
    private formatLabelOfXAxis(
        labelValue: number | string, 
        index: number, 
        amountOfLabels: number
    ): string {
        const formattedLabel: string = this.data.xLabelFormatter.format(labelValue);

        if (index === 0 || index === amountOfLabels - 1) {
            const maxWidthOfTheLatestLabel: number = Math.min(
                this.viewportIn.width,
                Default.MaxWidthOfTheLatestLabel
            );

            return Histogram.getTailoredTextOrDefault(
                formattedLabel,
                maxWidthOfTheLatestLabel
            );
        }

        return formattedLabel;
    }

    //REVIEW UNIQUE branch of updateAxes / UPDATE
    public calculateXAxes(
        metaDataColumn: DataViewMetadataColumn,
        widthOfLabel: number,
        scrollbarVisible: boolean
    ): IAxisProperties {
        let axes: IAxisProperties,
            width: number = this.viewportIn.width,
            xPoints: number[] = this.getDataDomain();

        axes = HistogramAxisHelper.createAxis({
            pixelSpan: this.viewportIn.width,
            dataDomain: xPoints,
            metaDataColumn,
            formatString: ValueFormatter.getFormatStringByColumn(metaDataColumn),
            outerPadding: Default.SvgOuterPadding,
            isScalar: false,
            isVertical: false,
            useTickIntervalForDisplayUnits: true,
            isCategoryAxis: true,
            getValueFn: (index, valueType) => index,
            scaleType: axisScale.linear,
            innerPaddingRatio: Default.InnerPaddingRatio,
            minOrdinalRectThickness: widthOfLabel,
            tickLabelPadding: undefined
        });

        axes.axisLabel = this.data.settings.general.displayName;

        axes.willLabelsFit = willLabelsFit(
            axes,
            width,
            textMeasurementService.measureSvgTextWidth,
            Default.TextProperties
        );

        // If labels do not fit and we are not scrolling, try word breaking
        axes.willLabelsWordBreak = (!axes.willLabelsFit && !scrollbarVisible) && willLabelsWordBreak(
            axes, Default.SvgMargin, width, textMeasurementService.measureSvgTextWidth,
            textMeasurementService.estimateSvgTextHeight, textMeasurementService.getTailoredTextOrDefault,
            Default.TextProperties
        );

        return axes;
    }

    //REVIEW UNIQUE branch of calculateXAxes / updateAxes / UPDATE
    private getDataDomain(): number[] {
        const { start, end } = this.data.settings.xAxis,
            { minX, maxX } = this.data.borderValues,
            interval: number = this.data.dataPoints[0].x1 - this.data.dataPoints[0].x0;
        let xPoints: number[],
            tmpStart: number,
            tmpEnd: number,
            tmpArr: number[],
            closerLimit: number;

        xPoints = Histogram.rangesToArray(this.data.dataPoints);
        // It is necessary to find out interval to calculate all necessary points before and after offset (if start and end for X axis was changed by user)
        if ((maxX !== end || minX !== start) && xPoints.length > 1) {

            // The interval must be greater than zero to avoid infinity loops
            if (interval > 0) {
                // If start point is greater than min border, it is necessary to remove non-using data points
                if (start > minX) {
                    closerLimit = this.findBorderMinCloserToXAxisStart(minX, start, interval);
                    xPoints = xPoints.filter(dpv => this.formatXLabelsForFiltering(dpv) >= closerLimit);
                    this.data.xCorrectedMin = xPoints && xPoints.length > 0 ? xPoints[0] : null;
                }
                else {
                    // Add points before
                    tmpArr = [];
                    tmpStart = minX;
                    while (start < tmpStart) {
                        tmpStart = tmpStart - interval;
                        tmpArr.push(tmpStart);
                        this.data.xCorrectedMin = tmpStart;
                    }
                    tmpArr.reverse();
                    xPoints = tmpArr.concat(xPoints);
                }

                // If end point is lesser than max border, it is necessary to remove non-using data points
                if (end < maxX) {
                    closerLimit = this.findBorderMaxCloserToXAxisEnd(maxX, end, interval);
                    xPoints = xPoints.filter(dpv => this.formatXLabelsForFiltering(dpv) <= closerLimit);
                    this.data.xCorrectedMax = xPoints && xPoints.length > 0 ? xPoints[xPoints.length - 1] : null;
                }
                else {
                    // Add points after
                    tmpEnd = maxX;
                    while (end > tmpEnd) {
                        tmpEnd = tmpEnd + interval;
                        xPoints.push(tmpEnd);
                        this.data.xCorrectedMax = tmpEnd;
                    }
                }
            }
        }

        return xPoints;
    }

    //REVIEW UNIQUE helper used by getDataDomain / calculateXAxes / updateAxes / UPDATE
    private static rangesToArray = (data: HistogramDataPoint[]): number[] =>
        data.reduce(
            (previousValue: number[], currentValue: HistogramDataPoint, index: number) => 
                previousValue.concat((index === 0)
                ? currentValue.range
                : currentValue.range.slice(1)), 
            []
        );

    //REVIEW UNIQUE helper used by  getDataDomain / calculateXAxes / updateAxes / UPDATE
    /// Using in case when xAxis start (set in options) is greater than calculated border min.
    /// This function detect the closest point to xAxis start (set in options).
    /// Each iteration tries to shift border limit right corresponding to interval
    /// and be closer to xAxis start at the same time.
    private findBorderMinCloserToXAxisStart(
        currentBorderMin: number,
        xAxisStart: number,
        interval: number
    ): number {
        while (currentBorderMin < xAxisStart && xAxisStart >= currentBorderMin + interval) {
            currentBorderMin += interval;
        }

        return this.formatXLabelsForFiltering(currentBorderMin);
    }

    //REVIEW UNIQUE helper used by  getDataDomain / calculateXAxes / updateAxes / UPDATE
    /// Using in case when xAxis end (set in options) is lesser than calculated border max.
    /// This function detect the closest point to xAxis end (set in options).
    /// Each iteration tries to shift border limit left corresponding to interval
    /// and be closer to xAxis end at the same time.
    private findBorderMaxCloserToXAxisEnd(
        currentBorderMax: number,
        xAxisEnd: number,
        interval: number
    ): number {
        while (currentBorderMax > xAxisEnd && xAxisEnd <= currentBorderMax - interval) {
            currentBorderMax -= interval;
        }
        return this.formatXLabelsForFiltering(currentBorderMax);
    }

/*
    ==================================================================================================
    UTILS
    ==================================================================================================
*/

    //REVIEW used by UPDATE and renderXAxis & renderYAxis / updateAxis / UPDATE
    private clearElement(selection: Selection<any>): void {
        selection
            .selectAll("*")
            .remove();
    }

    //REVIEW helper used in calculateXAxes & children
    private formatXLabelsForFiltering(
        nonFormattedPoint: number
    ): number {
        let formattedPoint: string = this.data.xLabelFormatter.format(nonFormattedPoint);
        return parseFloat(formattedPoint);
    }

    //REVIEW used by getTooltipData / getValuesByFrequencies / CONVERTER 
    //REVIEW used by renderLegend / UPDATE
    private static getLegendText = (
        settings: HistogramSettings, 
        localizationManager: ILocalizationManager
    ): string => 
        settings.general.frequency
            ? localizationManager.getDisplayName("Visual_Frequency")
            : localizationManager.getDisplayName("Visual_Density");
    
    //REVIEW helper used by getDataLegends / renderLegend / UPDATE 
    //REVIEW helper used by formatLabelOfXAxis / renderXAxis / updateAxis / UPDATE
    private static getTailoredTextOrDefault = (
        text: string, 
        maxWidth: number
    ): string =>
        textMeasurementService.getTailoredTextOrDefault(
            { text, ...Default.TextProperties }, 
            maxWidth
        );

}
