-- Idea-capture nvim overlay, loaded only by the iTerm "Ideas" hotkey window
-- (see ideas.json). Replaces the Raycast idea-capture extension with the same
-- storage contract: each idea becomes its own YYYY-MM-DD-HHMMSS.md file with
-- date frontmatter in the Obsidian vault's Ideas folder.
--
-- Flow: summon (Hyper+I) → fresh timestamped idea, cursor in insert mode →
-- type → toggle away (focus loss commits the file). Re-summon starts the next
-- idea. An untouched buffer is never written, so no empty files in the vault.

local VAULT = vim.env.IDEAS_VAULT or vim.fn.expand("~/Documents/Obsidian Vault/Ideas")

-- Window title: Hammerspoon's hotkeyCenter() finds the window by this.
vim.opt.title = true
vim.opt.titlestring = "Ideas"

-- Capture box, not an editor: no lint/style noise.
vim.diagnostic.enable(false)
vim.opt.spell = false
pcall(function()
        require("lint").linters_by_ft = {}
end)

local aug = vim.api.nvim_create_augroup("IdeaCapture", { clear = true })
local template = {}
local committed = false

local function newIdea()
        vim.fn.mkdir(VAULT, "p")
        local fname = os.date("%Y-%m-%d-%H%M%S") .. ".md"
        template = { "---", "date: " .. os.date("%Y-%m-%d %H:%M:%S"), "---", "", "" }
        vim.cmd("silent enew")
        vim.api.nvim_buf_set_name(0, VAULT .. "/" .. fname)
        vim.api.nvim_buf_set_lines(0, 0, -1, false, template)
        vim.bo.filetype = "markdown"
        vim.bo.modified = false
        committed = false
        vim.api.nvim_win_set_cursor(0, { #template, 0 })
        vim.cmd("startinsert")
end

-- Only write if the buffer changed beyond the pristine template.
local function commitIdea()
        local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
        if table.concat(lines, "\n") == table.concat(template, "\n") then
                return false
        end
        vim.cmd("silent! write!")
        return true
end

vim.api.nvim_create_autocmd("VimEnter", { group = aug, callback = newIdea })

vim.api.nvim_create_autocmd("FocusLost", {
        group = aug,
        callback = function()
                if commitIdea() then
                        committed = true
                end
        end,
})

-- Re-summon after a committed idea = start the next one. Coming back to an
-- uncommitted (still-empty or mid-thought) buffer continues it instead.
vim.api.nvim_create_autocmd("FocusGained", {
        group = aug,
        callback = function()
                if committed then
                        newIdea()
                end
        end,
})
