import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DailyCostData } from "@/types";

interface CostChartProps {
  data: DailyCostData[];
  loading?: boolean;
}

export const CostChart = ({ data, loading }: CostChartProps) => {
  const chartConfig = {
    cost: {
      label: "Cost ($)",
      color: "var(--chart-1)",
    },
    tokens: {
      label: "Tokens (K)",
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  // Transform data for the chart - scale tokens to thousands for visibility
  const chartData = data.map((d) => ({
    ...d,
    tokensK: d.tokens / 1000,
  }));

  return (
    <Card className="shadow-none border border-border/70 rounded-xl">
      <CardHeader className="pb-0">
        <CardTitle className="text-md lg:text-lg">Cost Trend</CardTitle>
        <CardDescription className="text-xs lg:text-sm">
          Daily estimated costs over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading chart data...
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="text-muted-foreground text-sm">
              No usage data yet. Start using the AI to see costs here.
            </div>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                width={60}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[180px]"
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                    }}
                    formatter={(value, name) => {
                      if (name === "cost") {
                        return [`$${Number(value).toFixed(4)}`, "Cost"];
                      }
                      if (name === "tokensK") {
                        return [
                          `${(Number(value) * 1000).toLocaleString()}`,
                          "Tokens",
                        ];
                      }
                      return [value, name];
                    }}
                  />
                }
              />
              <Line
                dataKey="cost"
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
