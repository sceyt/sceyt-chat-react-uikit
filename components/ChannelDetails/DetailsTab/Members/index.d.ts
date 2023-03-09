/// <reference types="react" />
import { IChannel } from '../../../../types';
interface IProps {
    channel: IChannel;
    chekActionPermission: (permission: string) => boolean;
    publicChannelDeleteMemberPopupDescription?: string;
    privateChannelDeleteMemberPopupDescription?: string;
    publicChannelRevokeAdminPopupDescription?: string;
    privateChannelRevokeAdminPopupDescription?: string;
    publicChannelMakeAdminPopupDescription?: string;
    privateChannelMakeAdminPopupDescription?: string;
    showChangeMemberRole?: boolean;
    showMakeMemberAdmin?: boolean;
    showKickMember?: boolean;
    showKickAndBlockMember?: boolean;
}
declare const Members: ({ channel, chekActionPermission, publicChannelDeleteMemberPopupDescription, privateChannelDeleteMemberPopupDescription, publicChannelRevokeAdminPopupDescription, privateChannelRevokeAdminPopupDescription, publicChannelMakeAdminPopupDescription, privateChannelMakeAdminPopupDescription, showChangeMemberRole, showMakeMemberAdmin, showKickMember, showKickAndBlockMember }: IProps) => JSX.Element;
export default Members;
