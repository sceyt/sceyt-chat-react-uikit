import React from 'react';
interface IChannelSearchProps {
    searchValue: string;
    handleSearchValueChange: (e: any) => void;
    getMyChannels: () => void;
}
declare const ChannelSearch: React.FC<IChannelSearchProps>;
export default ChannelSearch;
