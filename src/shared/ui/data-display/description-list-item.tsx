type Props = Readonly<{
  label: string;
  value: string;
}>;

function DescriptionListItem(props: Props) {
  return (
    <div>
      <dt className="inline text-foreground">{props.label}: </dt>
      <dd className="inline">{props.value}</dd>
    </div>
  );
}

export { DescriptionListItem };
