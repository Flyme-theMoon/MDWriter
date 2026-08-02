import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'

const mongoDbLanguage = LanguageDescription.of({
  name: 'MongoDB',
  alias: ['mongodb', 'mongo'],
  extensions: ['mongodb'],
  load: () =>
    import('@codemirror/lang-javascript').then((module) =>
      module.javascript({ jsx: false, typescript: false })
    )
})

const sqlServerLanguage = LanguageDescription.of({
  name: 'SQL Server',
  alias: ['sqlserver', 'mssql', 'tsql'],
  load: () =>
    import('@codemirror/lang-sql').then((module) =>
      module.sql({ dialect: module.MSSQL })
    )
})

export const editorLanguages = [
  ...languages,
  mongoDbLanguage,
  sqlServerLanguage
]
