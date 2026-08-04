import { mount } from 'svelte'
import App from './App.svelte'

const room = localStorage.getItem('pulsar.room')
if (room === 'night' || room === 'day') {
  document.documentElement.dataset['room'] = room
}

mount(App, { target: document.getElementById('app')! })
