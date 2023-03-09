import React from 'react';
interface IChannelListProps {
    showSearch?: boolean;
    uriPrefixOnCreateChannel?: string;
    createChannelIcon?: JSX.Element;
    createChannelIconHoverBackground?: string;
}
declare const CreateChannelButton: React.FC<IChannelListProps>;
export default CreateChannelButton;
