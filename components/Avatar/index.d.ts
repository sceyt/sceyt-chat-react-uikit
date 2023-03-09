import React from 'react';
interface IProps {
    image?: string | null;
    name: string;
    size?: number;
    textSize?: number;
    marginAuto?: boolean;
    setDefaultAvatar?: boolean;
    DeletedIcon?: JSX.Element;
}
declare const Avatar: React.FC<IProps>;
export default Avatar;
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
export declare const DefaultAvatarWrapper: import("styled-components").StyledComponent<any, any, object, string | number | symbol>;
export declare const DeletedAvatarWrapper: import("styled-components").StyledComponent<any, any, object, string | number | symbol>;
