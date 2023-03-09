interface ContainerProps {
    size?: number;
    avatarName: string;
    textSize?: number;
    isImage?: boolean;
    marginAuto?: boolean;
}
interface AvatarImageProps {
    showImage: boolean;
    size?: number;
}
export declare const Container: import("styled-components").StyledComponent<"div", any, ContainerProps, never>;
export declare const AvatarImage: import("styled-components").StyledComponent<"img", any, AvatarImageProps, never>;
export {};
