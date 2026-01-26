export const seo = ({
  title,
  description,
  keywords,
  image,
  url,
}: {
  title: string;
  description?: string;
  image?: string;
  keywords?: string;
  url?: string;
}) => {
  const tags = [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "og:type", content: "website" },
    { name: "og:title", content: title },
    { name: "og:description", content: description },
    ...(url ? [{ property: "og:url", content: url }] : []),
    ...(image
      ? [
          { name: "twitter:image", content: image },
          { name: "og:image", content: image },
        ]
      : []),
  ];

  return tags;
};
