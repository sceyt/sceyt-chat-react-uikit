import { IAttachment } from '../../../../types'

export interface GroupedAttachment {
  monthKey: string
  monthHeader: string
  files: IAttachment[]
}
