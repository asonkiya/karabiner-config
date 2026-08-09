-- Todo-list nvim overlay, loaded only by the iTerm "Todo" hotkey window
-- (see todo.json). Unlike the scratchpad (self-clearing) and ideas (fresh
-- file per summon), this is a single PERSISTENT file: a running todo list you
-- add to and check off over time. Lives in the Obsidian vault so it syncs.
--
-- Flow: summon (Hyper+T) → the todo file, right where you left it → edit →
-- toggle away (focus loss autosaves). Edits made elsewhere (Obsidian on
-- another synced device) are picked up on the next summon.

local TODO = vim.env.TODO_FILE or vim.fn.expand("~/Documents/Obsidian Vault/todo.md")

-- Window title: Hammerspoon's hotkeyCenter() finds the window by this.
vim.opt.title = true
vim.opt.titlestring = "Todo"

-- A list, not a code file: no lint/style noise.
vim.diagnostic.enable(false)
vim.opt.spell = false
pcall(function()
        require("lint").linters_by_ft = {}
end)

-- Reload the buffer if the file changed on disk (e.g. edited in Obsidian).
vim.opt.autoread = true

local aug = vim.api.nvim_create_augroup("Todo", { clear = true })

vim.api.nvim_create_autocmd("VimEnter", {
        group = aug,
        callback = function()
                vim.fn.mkdir(vim.fn.fnamemodify(TODO, ":h"), "p")
                vim.cmd("edit " .. vim.fn.fnameescape(TODO))
                vim.bo.filetype = "markdown"
        end,
})

-- Autosave when the window loses focus (it auto-hides on focus loss).
vim.api.nvim_create_autocmd("FocusLost", {
        group = aug,
        callback = function()
                vim.cmd("silent! wa")
        end,
})

-- Pull in external changes (Obsidian sync) when the window is re-summoned.
vim.api.nvim_create_autocmd("FocusGained", {
        group = aug,
        callback = function()
                vim.cmd("silent! checktime")
        end,
})
