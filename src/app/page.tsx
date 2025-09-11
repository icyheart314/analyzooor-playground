export default function Home() {
  return (
    <div className="max-w-7xl p-8">
      <div className="flex flex-col items-center">
        <h1>Whaleooor Analyzooor</h1>
        <p>by @pepo_is_fun</p>
        
        <div className="flex flex-col gap-4 mt-8">
          <a href="/token-flows">
            <button className="underline">Token Flow Rankings</button>
          </a>
        </div>
      </div>
    </div>
  );
}