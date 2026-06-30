import BackupConfig from '../models/BackupConfig.js'
import { runBackup } from '../controllers/backup.controller.js'

const backupJob = (agenda) => {
  agenda.define('auto_backup', async () => {
    try {
      const config = await BackupConfig.findOne({ key: 'global' })
      if (!config?.autoEnabled) return

      const hours = config.frequencyHours || 24
      if (config.lastBackupAt) {
        const elapsed = (Date.now() - new Date(config.lastBackupAt).getTime()) / (1000 * 60 * 60)
        if (elapsed < hours * 0.9) return
      }

      const result = await runBackup()
      console.log(`Backup automatico creado: ${result.filename} (${(result.size / 1024 / 1024).toFixed(2)} MB)`)
    } catch (err) {
      console.error('Error en job auto_backup:', err.message)
    }
  })
}

export default backupJob
