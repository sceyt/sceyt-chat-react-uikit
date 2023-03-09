/// <reference types="react" />
import { IMember } from '../../../types';
interface IMentionsPopupProps {
    channelId: string;
    addMentionMember: (member: IMember) => void;
    handleMentionsPopupClose: () => void;
    searchMention: string;
}
declare function MentionMembersPopup({ channelId, addMentionMember, handleMentionsPopupClose, searchMention }: IMentionsPopupProps): JSX.Element;
declare namespace MentionMembersPopup {
    var defaultProps: {
        activeItemIndex: null;
        searchMention: string;
    };
}
export default MentionMembersPopup;
