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

/// <reference path="_references.ts"/>

module powerbi.extensibility.visual.test {
    // powerbi.extensibility.visual.test
    import HistogramData = powerbi.extensibility.visual.test.HistogramData;
    import HistogramChartBuilder = powerbi.extensibility.visual.test.HistogramChartBuilder;
    import getSolidColorStructuralObject = powerbi.extensibility.visual.test.helpers.getSolidColorStructuralObject;

    // powerbi.extensibility.utils.svg
    import parseTranslateTransform = powerbi.extensibility.utils.svg.parseTranslateTransform;

    // powerbi.extensibility.utils.interactivity
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;

    // powerbi.extensibility.utils.test
    import createSelectionId = powerbi.extensibility.utils.test.mocks.createSelectionId;
    import assertColorsMatch = powerbi.extensibility.utils.test.helpers.color.assertColorsMatch;

    // Histogram1445664487616
    import VisualClass = powerbi.extensibility.visual.Histogram1445664487616.Histogram;
    import histogramUtils = powerbi.extensibility.visual.Histogram1445664487616.histogramUtils;
    import StateOfDataPoint = powerbi.extensibility.visual.Histogram1445664487616.StateOfDataPoint;
    import HistogramBehavior = powerbi.extensibility.visual.Histogram1445664487616.HistogramBehavior;
    import HistogramAxisStyle = powerbi.extensibility.visual.Histogram1445664487616.HistogramAxisStyle;
    import HistogramDataPoint = powerbi.extensibility.visual.Histogram1445664487616.HistogramDataPoint;

    describe("HistogramChart", () => {
        let visualBuilder: HistogramChartBuilder,
            dataViewBuilder: HistogramData,
            dataView: DataView;

        beforeEach(() => {
            visualBuilder = new HistogramChartBuilder(1000, 500);
            dataViewBuilder = new HistogramData();

            dataView = dataViewBuilder.getDataView();
        });

        describe("DOM tests", () => {
            it("svg element created", () => {
                expect(visualBuilder.mainElement[0]).toBeInDOM();
            });

            it("update", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const binsNumber: number = d3.layout
                        .histogram()
                        .frequency(true)(dataView.categorical.categories[0].values as number[]).length;

                    expect(visualBuilder.mainElement.find(".column").length).toBe(binsNumber);

                    done();
                });
            });

            it("update with one category", (done) => {
                dataView.categorical.categories[0].values = [1];
                dataView.categorical.values = null;

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const binsNumber: number = d3.layout
                        .histogram()
                        .frequency(true)(dataView.categorical.categories[0].values as number[]).length;

                    expect(visualBuilder.mainElement.find(".column").length).toBe(binsNumber);

                    done();
                });
            });

            it("data labels position validation", (done) => {
                dataViewBuilder.valuesCategory = [
                    10, 11, 12, 15, 16, 20,
                    21, 25, 26, 27, 28, 29,
                    30, 31, 40, 50, 60, 70
                ];

                dataViewBuilder.valuesValue = [
                    7, 6, 10, 4, 3, 3,
                    3, 6, 10, 4, 1, 7,
                    9, 2, 9, 4, 5, 7
                ];

                dataView = dataViewBuilder.getDataView();

                dataView.metadata.objects = {
                    labels: {
                        show: true
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const labels: Element[] = visualBuilder.labelTexts.get();

                    labels.forEach((label: Element) => {
                        let jqueryLabel: JQuery = $(label),
                            x: number,
                            y: number,
                            dx: number,
                            dy: number,
                            transform: { x: string, y: string },
                            currentX: number,
                            currentY: number;

                        x = Number(jqueryLabel.attr("x"));
                        y = Number(jqueryLabel.attr("y"));

                        transform = parseTranslateTransform(jqueryLabel.attr("transform"));

                        dx = Number(transform.x);
                        dy = Number(transform.y);

                        currentX = x + dx;
                        currentY = y + dy;

                        expect(currentX).toBeGreaterThan(0);
                        expect(currentY).toBeGreaterThan(0);

                        expect(currentX).toBeLessThan(visualBuilder.viewport.width);
                        expect(currentY).toBeLessThan(visualBuilder.viewport.height);

                        done();
                    });
                });
            });

            it("X-axis the latest labels should contain three dots when the precision is 17", (done) => {
                dataView.metadata.objects = {
                    xAxis: {
                        precision: 17
                    }
                };

                visualBuilder.updateRenderTimeout(dataView, () => {
                    const labels: JQuery = visualBuilder.xAxis.find(".tick text");

                    expectTextContainsThreeDots(labels.get(0).textContent);
                    expectTextContainsThreeDots(labels.get(labels.length - 1).textContent);

                    done();
                });

                function expectTextContainsThreeDots(text: string): void {
                    expect(text).toMatch("...");
                }
            });

            it("Y-axis start > end validation", () => {
                dataView.metadata.objects = {
                    yAxis: {
                        start: 65,
                        end: 33
                    }
                };

                visualBuilder.updateFlushAllD3Transitions(dataView);

                expect(parseFloat(visualBuilder.yAxisTicks.first().text())).toBe(0);
            });
        });

        describe("Format settings test", () => {
            describe("General", () => {
                it("frequency", () => {
                    dataView.metadata.objects = {
                        general: {
                            frequency: false
                        }
                    };

                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.yAxisTicks.length).toBeGreaterThan(1);
                });

                it("bins", () => {
                    let bins: number = 3;

                    dataView.metadata.objects = {
                        general: { bins }
                    };

                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.columnRects.length).toBe(bins);

                    bins = 6;

                    (dataView.metadata.objects as any).general.bins = bins;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.columnRects.length).toBe(bins);
                });
            });

            describe("Data colors", () => {
                it("color", () => {
                    const color: string = "#ABCDEF";

                    dataView.metadata.objects = {
                        dataPoint: {
                            fill: getSolidColorStructuralObject(color)
                        }
                    };

                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    visualBuilder.columnRects
                        .toArray()
                        .forEach((element: Element) => {
                            assertColorsMatch($(element).css("fill"), color);
                        });
                });
            });

            describe("X-axis", () => {
                beforeEach(() => {
                    dataView.metadata.objects = {
                        xAxis: {
                            show: true
                        }
                    };
                });

                it("show", () => {
                    (dataView.metadata.objects as any).xAxis.show = true;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.xAxisTicks).toBeInDOM();

                    (dataView.metadata.objects as any).xAxis.show = false;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.xAxisTicks).not.toBeInDOM();
                });

                it("display Units", () => {
                    const displayUnits: number = 1000;

                    (dataView.metadata.objects as any).xAxis.displayUnits = displayUnits;

                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    visualBuilder.xAxisTicks
                        .toArray()
                        .forEach((element: Element) => {
                            expect(_.last($(element).text())).toEqual("K");
                        });
                });

                it("title", () => {
                    (dataView.metadata.objects as any).xAxis.title = true;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.xAxisLabel.css("display")).not.toBe("none");

                    (dataView.metadata.objects as any).xAxis.title = false;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.xAxisLabel.css("display")).toBe("none");
                });
            });

            describe("Y-axis", () => {
                beforeEach(() => {
                    dataView.metadata.objects = {
                        yAxis: {
                            show: true
                        }
                    };
                });

                it("show", () => {
                    (dataView.metadata.objects as any).yAxis.show = true;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.yAxisTicks).toBeInDOM();

                    (dataView.metadata.objects as any).yAxis.show = false;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.yAxisTicks).not.toBeInDOM();
                });

                it("display Units", () => {
                    const displayUnits: number = 1000;

                    (dataView.metadata.objects as any).yAxis.displayUnits = displayUnits;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    visualBuilder.yAxisTicks
                        .toArray()
                        .forEach((element: Element) => {
                            expect(_.last($(element).text())).toEqual("K");
                        });
                });

                it("title", () => {
                    (dataView.metadata.objects as any).yAxis.title = true;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.yAxisLabel.css("display")).not.toBe("none");

                    (dataView.metadata.objects as any).yAxis.title = false;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.yAxisLabel.css("display")).toBe("none");
                });

                it("position", () => {
                    (dataView.metadata.objects as any).yAxis.position = "Left";
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    const xLeft: number = getAxisTranslate(visualBuilder);

                    (dataView.metadata.objects as any).yAxis.position = "Right";
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    const xRight: number = getAxisTranslate(visualBuilder);

                    expect(xRight).toBeGreaterThan(xLeft);
                });

                function getAxisTranslate(visualBuilder: HistogramChartBuilder): number {
                    return d3.transform(visualBuilder.yAxis.attr("transform")).translate[0];
                }
            });

            describe("Data labels", () => {
                beforeEach(() => {
                    dataView.metadata.objects = {
                        labels: {
                            show: true
                        }
                    };
                });

                it("show", () => {
                    (dataView.metadata.objects as any).labels.show = true;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.labelTexts).toBeInDOM();
                    expect(visualBuilder.columnRects.length).toBe(visualBuilder.labelTexts.length);

                    (dataView.metadata.objects as any).labels.show = false;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    expect(visualBuilder.labelTexts).not.toBeInDOM();
                });

                it("display units", () => {
                    let displayUnits: number = 1000;

                    (dataView.metadata.objects as any).labels.displayUnits = displayUnits;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    visualBuilder.labelTexts
                        .toArray()
                        .forEach((element: Element) => {
                            expect(_.last($(element).text())).toEqual("K");
                        });

                    displayUnits = 1000 * 1000;

                    (dataView.metadata.objects as any).labels.displayUnits = displayUnits;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    visualBuilder.labelTexts
                        .toArray()
                        .forEach((element: Element) => {
                            expect(_.last($(element).text())).toEqual("M");
                        });
                });

                it("precision", () => {
                    const precision: number = 7;

                    (dataView.metadata.objects as any).labels.displayUnits = 1;
                    (dataView.metadata.objects as any).labels.precision = precision;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    visualBuilder.labelTexts
                        .toArray()
                        .forEach((element: Element) => {
                            expect($(element).text().split(".")[1].length).toEqual(precision);
                        });
                });

                it("font-size", () => {
                    const fontSize: number = 22,
                        expectedFontSize: string = "29.3333px";

                    (dataView.metadata.objects as any).labels.fontSize = fontSize;
                    visualBuilder.updateFlushAllD3Transitions(dataView);

                    visualBuilder.labelTexts
                        .toArray()
                        .forEach((element: Element) => {
                            expect($(element).css("font-size")).toBe(expectedFontSize);
                        });
                });
            });
        });

        describe("getLegend", () => {
            it("getLegend should return the title without any modifications", () => {
                let title: string = "Power BI",
                    legendTitle: string;

                legendTitle = VisualClass.getLegend(title, HistogramAxisStyle.showTitleOnly, 0);

                expect(legendTitle).toBe(title);
            });

            it("getLegend shouldn't throw any exceptions when axisStyle.showUnitOnly and displayUnits is NaN", () => {
                expect(() => {
                    VisualClass.getLegend("Power BI", HistogramAxisStyle.showUnitOnly, NaN);
                }).not.toThrow();
            });

            it("getLegend shouldn't throw any exceptions when axisStyle.showBoth and displayUnits is NaN", () => {
                expect(() => {
                    VisualClass.getLegend("Power BI", HistogramAxisStyle.showBoth, NaN);
                }).not.toThrow();
            });
        });

        describe("areValuesNumbers", () => {
            it("the method should return true when category is integer", () => {
                let areValuesNumbers: boolean,
                    categoryColumn = createCategoryColumn(true);

                areValuesNumbers = VisualClass.areValuesNumbers(categoryColumn);

                expect(areValuesNumbers).toBeTruthy();
            });

            it("the method should return true when category is numeric", () => {
                let areValuesNumbers: boolean,
                    categoryColumn = createCategoryColumn(undefined, true);

                areValuesNumbers = VisualClass.areValuesNumbers(categoryColumn);

                expect(areValuesNumbers).toBeTruthy();
            });

            it("the method should return false when category isn't numeric or integer", () => {
                let areValuesNumbers: boolean,
                    categoryColumn = createCategoryColumn();

                areValuesNumbers = VisualClass.areValuesNumbers(categoryColumn);

                expect(areValuesNumbers).toBeFalsy();
            });

            function createCategoryColumn(
                isInteger: boolean = undefined,
                isNumeric: boolean = undefined): DataViewCategoryColumn {

                return {
                    source: {
                        displayName: undefined,
                        type: {
                            integer: isInteger,
                            numeric: isNumeric
                        }
                    },
                    values: []
                };
            }
        });

        describe("getCorrectXAxisValue", () => {
            it("the method should return a value that equals MaxXAxisEndValue", () => {
                checkCorrectXAxisValue(Number.MAX_VALUE, VisualClass.MaxXAxisEndValue);
            });

            it("the method should return a value that equals MinXAxisStartValue", () => {
                checkCorrectXAxisValue(-Number.MIN_VALUE, VisualClass.MinXAxisStartValue);
            });

            it("the method should return the same value", () => {
                const value: number = 42;

                checkCorrectXAxisValue(value, value);
            });

            function checkCorrectXAxisValue(
                actualValue: number,
                expectedValue: number): void {

                const value: number = VisualClass.getCorrectXAxisValue(actualValue);

                expect(value).toBe(expectedValue);
            }
        });

        describe("histogramUtils", () => {
            describe("getFillOpacity", () => {
                it("method should return DimmedOpacity when hasSelection is true, selected is false", () => {
                    let fillOpacity: number;

                    fillOpacity = histogramUtils.getFillOpacity(false, false, true, false);

                    expect(fillOpacity).toBe(histogramUtils.DimmedOpacity);
                });

                it("method should return DefaultOpacity when hasSelection is true, selected is true", () => {
                    let fillOpacity: number;

                    fillOpacity = histogramUtils.getFillOpacity(true, false, true, false);

                    expect(fillOpacity).toBe(histogramUtils.DefaultOpacity);
                });
            });

            describe("getStateOfDataPoint", () => {
                it("method should return { selected: false, highlight: false } when the dataPoint isn't selected", () => {
                    checkStateOfDataPoint(false, false);
                });

                it("method should return { selected: true, highlight: true } when the dataPoint is selected", () => {
                    checkStateOfDataPoint(true, true);
                });

                function checkStateOfDataPoint(selected: boolean, highlight: boolean): void {
                    let dataPoint: HistogramDataPoint = createDataPoint(selected, highlight),
                        stateOfDataPoint: StateOfDataPoint;

                    stateOfDataPoint = histogramUtils.getStateOfDataPoint(dataPoint);

                    expect(stateOfDataPoint.selected).toBe(selected);
                    expect(stateOfDataPoint.highlight).toBe(highlight);
                }

                function createDataPoint(selected: boolean, highlight: boolean): HistogramDataPoint {
                    let dataPoint: HistogramDataPoint = <HistogramDataPoint>[];

                    dataPoint.subDataPoints = [{
                        selected: selected,
                        highlight: highlight,
                        identity: null
                    }];

                    return dataPoint;
                }
            });
        });

        describe("HistogramBehavior", () => {
            describe("areDataPointsSelected", () => {
                it("method should return false when dataPoint aren't the same", () => {
                    let areDataPointsSelected: boolean,
                        firstDataPoint: SelectableDataPoint[] = [createSelectableDataPoint()],
                        secondDataPoint: SelectableDataPoint[] = [
                            createSelectableDataPoint(true, null)
                        ];

                    areDataPointsSelected = HistogramBehavior.areDataPointsSelected(
                        firstDataPoint, secondDataPoint);

                    expect(areDataPointsSelected).toBeFalsy();
                });

                it("method should return true when dataPoint are the same", () => {
                    let areDataPointsSelected: boolean,
                        selectableDataPoint: SelectableDataPoint[] = [createSelectableDataPoint()];

                    areDataPointsSelected = HistogramBehavior.areDataPointsSelected(
                        selectableDataPoint, selectableDataPoint);

                    expect(areDataPointsSelected).toBeTruthy();
                });
            });

            function createSelectableDataPoint(
                selected: boolean = false,
                identity: ISelectionId = createSelectionId()): SelectableDataPoint {

                return { selected, identity };
            }
        });
    });
}
