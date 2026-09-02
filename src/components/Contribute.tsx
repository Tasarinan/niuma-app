import { Button, Card, CardContent, CardDescription, CardTitle } from "./ui";

const SUPPORT_EMAIL = "niuma8@888.com";

const Contribute = () => {
  return (
    <Card className="w-full">
      <CardContent className="flex flex-col gap-4 p-4 py-0 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2 md:max-w-[70%]">
          <CardTitle className="text-xs lg:text-sm">
            贡献：增加新的团队
          </CardTitle>
          <CardDescription className="text-[10px] lg:text-xs">
            Niuma 的团队可以按你的日常场景扩展。告诉我们你想增加的团队、
            这个团队要处理的任务，以及需要哪些 agents、commands 或 skills。
          </CardDescription>
        </div>
        <Button asChild className="w-full md:w-auto text-[10px] lg:text-xs">
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Niuma%20new%20team%20request`}
            rel="noopener noreferrer"
            target="_blank"
          >
            联系支持
          </a>
        </Button>
      </CardContent>
    </Card>
  );
};

export default Contribute;
