import { Button, Card, CardContent, CardDescription, CardTitle } from "./ui";

const SUPPORT_EMAIL = "niuma8@888.com";

const Promote = () => {
  return (
    <Card className="w-full">
      <CardContent className="flex flex-col gap-4 p-4 py-0 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2 md:max-w-[70%]">
          <CardTitle className="text-xs lg:text-sm">
            推广 Niuma，或用微信赞助
          </CardTitle>
          <CardDescription className="text-[10px] lg:text-xs">
            喜欢 Niuma 可以把它转发给朋友、同事或社群。微信支付码赞助入口已预留，
            后续放入二维码图片后即可展示。
          </CardDescription>
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground lg:text-xs">
            微信支付码赞助：二维码图片待补充
          </div>
        </div>
        <Button asChild className="w-full md:w-auto text-[10px] lg:text-xs">
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Niuma%20promotion%20or%20sponsor`}
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

export default Promote;
