interface PageIntroProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export default function PageIntro({ title, subtitle, action }: PageIntroProps) {
  return (
    <header className="page-intro">
      <div className="page-intro__copy">
        <h1 className="page-intro__title">{title}</h1>
        <p className="page-intro__subtitle">{subtitle}</p>
      </div>
      {action ? <div className="page-intro__action">{action}</div> : null}
    </header>
  );
}
