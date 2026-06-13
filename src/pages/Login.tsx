import { useEffect, useState } from 'react'
import { Store, Delete } from 'lucide-react'
import type { User } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../store/app'

export default function Login() {
  const { setUser, settings } = useApp()
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void api.listUsers().then((list) => {
      setUsers(list)
      setSelected(list[0] ?? null)
    })
  }, [])

  const submit = async (finalPin: string) => {
    if (!selected) return
    const res = await api.login(selected.username, finalPin)
    if (res.ok && res.user) {
      setUser(res.user)
    } else {
      setError(res.error ?? 'Login failed')
      setPin('')
    }
  }

  const press = (d: string) => {
    setError('')
    const next = (pin + d).slice(0, 6)
    setPin(next)
    if (next.length >= 4) void submit(next)
  }

  return (
    <div className="grid h-full place-items-center bg-gray-50 p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gray-900 text-white">
            <Store size={26} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{settings?.shop.name ?? 'Nexus POS'}</h1>
          <p className="text-sm text-gray-500">Select your account and enter your PIN</p>
        </div>

        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {users.map((u) => (
            <button
              key={u._id}
              onClick={() => {
                setSelected(u)
                setPin('')
                setError('')
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                selected?._id === u._id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>

        <div className="mb-4 flex justify-center gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-gray-900' : 'bg-gray-200'} ${
                i >= 4 && pin.length < 5 ? 'opacity-30' : ''
              }`}
            />
          ))}
        </div>
        {error && <p className="mb-3 text-center text-sm text-rose-600">{error}</p>}

        <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="btn-ghost h-14 text-lg" onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button className="btn-ghost h-14" onClick={() => setPin('')}>
            C
          </button>
          <button className="btn-ghost h-14 text-lg" onClick={() => press('0')}>
            0
          </button>
          <button className="btn-ghost h-14" onClick={() => setPin(pin.slice(0, -1))}>
            <Delete size={18} />
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Demo: <span className="text-gray-700">Store Owner</span> PIN 1234 · <span className="text-gray-700">Cashier</span> PIN 1111
        </p>
      </div>
    </div>
  )
}
