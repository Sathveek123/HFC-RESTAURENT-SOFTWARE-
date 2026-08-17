import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tableNumber: string }>
}

export default async function TableTrackRedirect({ params }: Props) {
  const { tableNumber } = await params
  redirect(`/table/${tableNumber}`)
}
