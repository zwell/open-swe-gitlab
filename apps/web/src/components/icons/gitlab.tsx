interface GitLabSVGProps {
  width?: string;
  height?: string;
  className?: string;
}

export const GitLabSVG = ({
                            width = "100%",
                            height = "100%",
                            className,
                          }: GitLabSVGProps) => (
    <svg
        role="img"
        viewBox="0 0 24 24" // The GitLab logo also fits well in a 24x24 viewbox
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor" // This is kept so the icon inherits its color
        className={className}
    >
      <title>GitLab</title> {/* Changed from GitHub to GitLab */}
      {/* The <path> data below is for the GitLab logo */}
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.213A.333.333 0 0 0 19.623.95L12 3.411 4.377.95a.333.333 0 0 0-.326.289L1.387 9.452.045 13.587a.89.89 0 0 0 .323 1.043l11.632 8.687a.26.26 0 0 0 .316-.003l11.316-8.495a.89.89 0 0 0 .323-1.04Z" />
    </svg>
);